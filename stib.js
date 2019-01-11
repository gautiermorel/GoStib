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

				console.log('body=', body);

				if (!access_token) {
					console.log('ERROR: stib.js#init - Error cause no access_token');
					return reject('NO_ACCESS_TOKEN');
				}
				return resolve({ access_token: access_token, expires_in: expires_in });
			});
		})
	}

	async run(end) {
		console.log('INFO: stib.js#run');

		try { await this.request() }
		catch (error) {
			console.log('ERROR: stib.js#run - Error while requesting stib:', error);
			return true;
		}

		if (moment().isBefore(end)) return this.run(end);
		return true;
	}

	request() {
		return new Promise(async (resolve, reject) => {
			let token;
			try { token = await this.init() }
			catch (error) {
				console.log('ERROR: index.js#onTick - Cannot generate access_token from STIB:', error);
				return reject(false);
			}

			let { access_token = null, expires_in = null } = token || {};

			if (!access_token || !expires_in) {
				console.log('ERROR: index.js#onTick - No access_token or expirin_in found')
				return reject(false);
			}

			let renewToken = moment().add(expires_in, 'millisecond');

			console.log('INFO: index.js#onTick - expires_in=', expires_in, '| Need to be renew at:', renewToken.toDate());

			let timeoutPromise = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

			await timeoutPromise(60000);

			// Now checking time for DARWIN_TO_SCHAERBEEK.
			let passingTimes;
			try { passingTimes = await this.getPassingTimeByPoint(access_token, DARWIN_TO_SCHAERBEEK) }
			catch (error) {
				console.log('ERROR: index.js#onTick - Unable to get passing time by point:', error);
				return reject(false);
			}

			let [nextTram, upcommingTram] = passingTimes || [];

			if (!nextTram || !upcommingTram) {
				console.log('ERROR: index.js#onTick - No available informations returned');
				return reject(false);
			}

			let { expectedArrivalTime = null } = nextTram;

			if (!expectedArrivalTime) {
				console.log('ERROR: index.js#onTick - No available expectedArrivalTime returned');
				return reject(false);
			}

			let remainingTime = helpers.getRemainingMinutes(expectedArrivalTime);

			if (remainingTime < 3) {
				console.log('INFO: we will warn Gautier that he can leave now !', remainingTime);
				let text = `Hey, next tram is in ${remainingTime} minutes !`
				messenger.sendMessage(RECIPIENT_ID, { text: text });
			}

			if (remainingTime > 3) {
				console.log('INFO: no need to warn Gautier, he still has time:', remainingTime);
				let text = `No need to worry, your next tram is in ${remainingTime} minutes !`
				messenger.sendMessage(RECIPIENT_ID, { text: text });
			}

			if (moment().isAfter(renewToken)) return resolve(true);

			return this.request();
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
					console.log('ERROR: stib.js#init - Error while requesting client token:', error);
					return reject(error);
				}

				if (response && response.statusCode && response.statusCode !== 200) {
					console.log('ERROR: stib.js#init - Error but we got an code error:', response.statusCode);
					return reject(response.statusCode);
				}


				let [data = {}] = body.points || [];
				let { passingTimes = [] } = data

				return resolve(passingTimes);
			});
		})
	}
}
