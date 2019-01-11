'use strict';

const request = require('request');

module.exports = class Messenger {
	constructor() {
		this.api_endpoint = '';
		this.verify_token = '';
		this.profile_token = '';
	}

	handleVerify(req, res) {
		if (req.query['hub.verify_token'] === this.verify_token) {
			return res.send(req.query['hub.challenge']);
		}
		return res.send('Validation failed, Verify token mismatch');
	}

	receiveMessage(req, res) {
		const messageInstances = req.body.entry[0].messaging;
		messageInstances.forEach((instance) => {
		});
		res.sendStatus(200);
	}

	sendMessage() {
		return new Promise((resolve, reject) => {
			request({
				url: `${this.api_endpoint}`,
				method: 'POST',
				qs: {
					access_token: `${this.profile_token}`
				},
				json: {
					recipient: { id: receiver },
					message: payload,
				}
			}, (error, response, body) => {

			});
		});
	}
}
