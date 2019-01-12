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
	}

	init() {
		let formData = querystring.stringify({ grant_type: 'client_credentials' });
		let contentLength = formData.length;
		let credentials = Buffer.from(`${this.stib_consumer_key}:${this.stib_consumer_secret}`).toString('base64');


		console.log('INFO: stib.js#init - Credentials=', credentials);

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

		let { access_token = null, expires_in = 0 } = _token || {};

		let renewToken = moment().add(expires_in, 'seconds');
		console.log('INFO: stib.js#request - expires_in=', expires_in, '| Need to be renew at:', renewToken.toDate());

		let token;
		console.log('INFO: stib.js#run - No token sent or token expired so we need to generate a new one');
		if (!access_token || !expires_in || moment().isAfter(renewToken)) {
			console.log('INFO: stib.js#run - We will generate a new token');
			try { token = await this.init() }
			catch (error) {
				console.log('ERROR: stib.js#request - Cannot generate access_token from STIB:', error);
				return false;
			}

			console.log('INFO: stib.js#run - Need to redefined new access_token & expires_in value');
			access_token = (token && token.access_token) || null;
			expires_in = (token && token.expires_in) || null;
		}

		token = {
			access_token: access_token,
			expires_in: expires_in
		}

		if (!access_token || !expires_in) {
			console.log('ERROR: stib.js#request - No access_token or expirin_in found')
			return false;
		}


		console.log('INFO: stib.js#run - token=', token);

		try { await this.request(token) }
		catch (error) {
			console.log('ERROR: stib.js#run - Error while requesting stib:', error);
			return true;
		}

		if (moment().isBefore(end)) return this.run(end, token);
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

			let [nextTram, upcommingTram] = passingTimes || [];

			if (!nextTram || !upcommingTram) {
				console.log('ERROR: stib.js#request - No available informations returned');
				return reject(false);
			}

			let { expectedArrivalTime = null } = nextTram;

			if (!expectedArrivalTime) {
				console.log('ERROR: stib.js#request - No available expectedArrivalTime returned');
				return reject(false);
			}

			let remainingTime = helpers.getRemainingMinutes(expectedArrivalTime);

			if (remainingTime < 3) {
				console.log('INFO: we will warn Gautier that he can leave now !', remainingTime);
				let text = `Hey, next tram is in ${remainingTime} minutes !`

				try { await messenger.sendMessage(RECIPIENT_ID, { text: text }); }
				catch (error) {
					console.log('ERROR: stib.js#request - Unable to send messenger message when remaining tome is less than 3 min:', error);
					return reject(false);
				}
			}

			if (remainingTime > 3) {
				console.log('INFO: no need to warn Gautier, he still has time:', remainingTime);
				let text = `No need to worry, your next tram is in ${remainingTime} minutes !`

				try { await messenger.sendMessage(RECIPIENT_ID, { text: text }); }
				catch (error) {
					console.log('ERROR: stib.js#request - Unable to send messenger message when remaining time is up to 3 min:', error);
					return reject(false);
				}
			}

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
}
