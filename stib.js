'use strict';

const request = require('request');
const querystring = require('querystring');
const moment = require('moment');

const Messenger = require('./messenger');
const Helpers = require('./helpers');

let messenger = new Messenger();
let helpers = new Helpers();

const { STIB_API_ENDPOINT = 'https://opendata-api.stib-mivb.be', STIB_CONSUMER_KEY = null, STIB_CONSUMER_SECRET = null, DARWIN_TO_SCHAERBEEK = '5063', RECIPIENT_ID = '2195253467206298' } = process.env;

module.exports = class STIB {
	constructor() {
		this.stib_api_endpoint = STIB_API_ENDPOINT;
		this.stib_consumer_key = STIB_CONSUMER_KEY;
		this.stib_consumer_secret = STIB_CONSUMER_SECRET;
		this.stop = false;
		this.runInProgress = false;
	}

	init() {
		console.log('INFO: stib.js#init');

		let formData = querystring.stringify({ grant_type: 'client_credentials' });
		let contentLength = formData.length;
		let credentials = Buffer.from(`${this.stib_consumer_key}:${this.stib_consumer_secret}`).toString('base64');

		return new Promise((resolve, reject) => {
			request({
				url: `${this.stib_api_endpoint}/token`,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': contentLength,
					Authorization: `Basic ${credentials}`
				},
				method: 'POST',
				body: formData,
				json: true
			}, (error, response, body) => {
				if (error) {
					console.log('ERROR: stib.js#init - Error while requesting client token:', error);
					return reject(error);
				}

				if (response && response.statusCode && response.statusCode !== 200) {
					console.log('ERROR: stib.js#init - Error but we got an code error:', response.statusCode);
					return reject(response.statusCode);
				}

				let { access_token = null, expires_in = 0 } = body;

				if (!access_token) {
					console.log('ERROR: stib.js#init - Error cause no access_token');
					return reject('NO_ACCESS_TOKEN');
				}
				return resolve({ access_token: access_token, expires_in: expires_in });
			});
		})
	}

	async run(end, _token) {
		console.log('INFO: stib.js#run');
		this.stop = true;
		if (this.runInProgress) {
			console.log('INFO: stib.js#run - Already a run in progress');
			let info = 'Un scan est déjà en cours';
			try { await messenger.sendMessage(RECIPIENT_ID, { text: info }); }
			catch (error) {
				console.log('ERROR: stib.js#run - Unable to send messenger message:', error);
				return false;
			}

			return false;
		}
		this.runInProgress = true;

		let text = 'Session scan activée !';
		try { await messenger.sendMessage(RECIPIENT_ID, { text: text }); }
		catch (error) {
			console.log('ERROR: stib.js#run - Unable to send messenger message:', error);
			return false;
		}

		let { access_token = null, expires_in = 0, expire_when = moment() } = _token || {};

		console.log('INFO: stib.js#request - expires_in=', expires_in, '| Need to be renew at:', expire_when.toDate());

		let token;
		if (!access_token || !expires_in || moment().isAfter(expire_when)) {
			console.log('INFO: stib.js#run - We will generate a new token');
			try { token = await this.init() }
			catch (error) {
				console.log('ERROR: stib.js#request - Cannot generate access_token from STIB:', error);
				return false;
			}

			console.log('INFO: stib.js#run - Need to redefined new access_token & expires_in value');
			access_token = (token && token.access_token) || null;
			expires_in = (token && token.expires_in) || 0;
			expire_when = moment().add(expires_in, 'seconds');
		}

		console.log('INFO: stib.js#run - Reassign token with updated values');
		token = {
			access_token: access_token,
			expires_in: expires_in,
			expire_when: expire_when
		}

		if (!access_token || !expires_in || !expire_when) {
			console.log('ERROR: stib.js#request - No access_token or expirin_in or expire_when found')
			return false;
		}

		try { await this.request(token) }
		catch (error) {
			console.log('ERROR: stib.js#run - Error while requesting stib:', error);
			return true;
		}

		if (moment().isBefore(end) && !this.stop) return this.run(end, token);

		this.runInProgress = false;
		return true;
	}

	request(token) {
		console.log('INFO: stib.js#request');
		return new Promise(async (resolve, reject) => {
			let { access_token = null } = token || {};

			// Now checking time for DARWIN_TO_SCHAERBEEK.
			let passingTimes;
			try { passingTimes = await this.getPassingTimeByPoint(access_token, DARWIN_TO_SCHAERBEEK) }
			catch (error) {
				console.log('ERROR: stib.js#request - Unable to get passing time by point:', error);
				return reject(false);
			}

			let [upcommingTram, nextTram] = passingTimes || [];

			if (!upcommingTram && !nextTram) {
				console.log('ERROR: stib.js#request - No available informations returned');
				return reject(false);
			}

			let { expectedArrivalTime: expectedArrivalTimeUpcommingTram = null, destination = {}, lineId = 0 } = upcommingTram || {};
			let { expectedArrivalTime: expectedArrivalTimeNextTram = null } = nextTram || {};
			let { fr: destinationName = '' } = destination;

			console.log('INFO: stib.js#request - UpcommingTram infos:', upcommingTram);

			if (!expectedArrivalTimeUpcommingTram || !expectedArrivalTimeNextTram) {
				console.log('ERROR: stib.js#request - No available expectedArrivalTime returned');
				return reject(false);
			}

			let remainingTime = helpers.getRemainingMinutes(expectedArrivalTimeUpcommingTram);
			let remainingTimeNextTram = helpers.getRemainingMinutes(expectedArrivalTimeNextTram);

			if (remainingTime <= 4) {
				console.log('INFO: stib.js#request - Remaining time is less than 4 minutes:', remainingTime);
				let text = `Upcomming tram to ${destinationName} (${lineId}) is in ${remainingTime} minute(s) ! - The next one will arrive in ${remainingTimeNextTram} minute(s)`
				if (remainingTime === 0) text = `Tram to ${destinationName} (${lineId}) is now approching ! - The next one will arrive in ${remainingTimeNextTram} minute(s)`;

				try { await messenger.sendMessage(RECIPIENT_ID, { text: text }); }
				catch (error) {
					console.log('ERROR: stib.js#request - Unable to send messenger message when remaining tome is less than 3 min:', error);
					return reject(false);
				}
			}

			if (remainingTime > 4) console.log(`INFO: stib.js#request - Upcomming tram to ${destinationName} (${lineId}) is in ${remainingTime} minute(s) !`);

			console.log('INFO: stib.js#request - Wait 40 seconds');
			let timeoutPromise = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));
			await timeoutPromise(40000);

			return resolve(true);
		})
	}

	getPassingTimeByPoint(access_token, point) {
		return new Promise((resolve, reject) => {
			request({
				url: `${this.stib_api_endpoint}/OperationMonitoring/3.0/PassingTimeByPoint/${point}`,
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${access_token}`
				},
				json: true
			}, (error, response, body) => {
				if (error) {
					console.log('ERROR: stib.js#getPassingTimeByPoint - Error while requesting client token:', error);
					return reject(error);
				}

				if (response && response.statusCode && response.statusCode !== 200) {
					console.log('ERROR: stib.js#getPassingTimeByPoint - Error but we got an code error:', response.statusCode);
					return reject(response.statusCode);
				}


				let [data = {}] = body.points || [];
				let { passingTimes = [] } = data

				return resolve(passingTimes);
			});
		})
	}

	stop() {
		console.log('INFO: stib.js#stop - Setting this.stop to true');
		return new Promise(resolve => {
			this.stop = true;
			return resolve(true);
		})
	}
}
