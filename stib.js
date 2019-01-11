'use strict';

const request = require('request');
const querystring = require('querystring');

module.exports = class STIB {
	constructor() {
		this.api_endpoint = 'https://opendata-api.stib-mivb.be';
		this.consumer_key = 'zcoDSxfbS7PKWkeWUsEHgp9MGM4a';
		this.consumer_secret = 'BD_uR9OMcV2CZKdtjERgvFvjbEYa';
	}

	init() {
		let formData = querystring.stringify({ grant_type: 'client_credentials' });
		let contentLength = formData.length;
		let credentials = Buffer.from(`${this.consumer_key}:${this.consumer_secret}`).toString('base64');

		return new Promise((resolve, reject) => {
			request({
				url: `${this.api_endpoint}/token`,
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

				let { access_token = null } = body;

				if (!access_token) {
					console.log('ERROR: stib.js#init - Error cause no access_token');
					return reject('NO_ACCESS_TOKEN');
				}
				return resolve(access_token);
			});
		})
	}

	getPassingTimeByPoint(access_token, point) {
		return new Promise((resolve, reject) => {
			request({
				url: `${this.api_endpoint}/OperationMonitoring/3.0/PassingTimeByPoint/${point}`,
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
