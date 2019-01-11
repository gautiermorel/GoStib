'use strict';

const request = require('request');

const { MESSENGER_API_ENDPOINT = 'https://opendata-api.stib-mivb.be', MESSENGER_VERIFY_TOKEN = null, MESSENGER_PROFILE_TOKEN = null } = process.env;

module.exports = class Messenger {
	constructor() {
		this.messenger_api_endpoint = MESSENGER_API_ENDPOINT;
		this.messenger_verify_token = MESSENGER_VERIFY_TOKEN;
		this.messenger_profile_token = MESSENGER_PROFILE_TOKEN;
	}

	handleVerify(req, res) {
		if (req.query['hub.verify_token'] === this.messenger_verify_token) {
			return res.send(req.query['hub.challenge']);
		}
		return res.send('Validation failed, Verify token mismatch');
	}

	async receiveMessage(req, res) {
		let messageInstances = req.body.entry[0].messaging;
		let messageInstancesSize = messageInstances.length;

		let promises = [];
		for (let i = 0; i < messageInstancesSize; i++) {
			let instance = messageInstances[i];
			console.log('instance=', instance);

			let { id: senderId = null } = (instance && instance.sender) || {};
			let { is_echo = false } = (instance && instance.message) || {};

			if (!is_echo) {
				promises.push(this.sendMessage(senderId))
			}
		}

		try { await Promise.all(promises) }
		catch (error) { console.log('ERROR: messenger.js#receiveMessage - Unable to send message:', error) }

		res.sendStatus(200);
	}

	sendMessage(recipientId) {
		console.log('send message')
		return new Promise((resolve, reject) => {
			if (recipientId !== '2195253467206298') return resolve(true);
			request({
				url: `${this.messenger_api_endpoint}`,
				method: 'POST',
				qs: {
					access_token: `${this.messenger_profile_token}`
				},
				json: {
					recipient: { id: recipientId },
					message: {
						text: 'Bonjour'
					}
				}
			}, (error, res, body) => {
				console.log('HELLO from res:', body);
				if (error) reject(error);
				return resolve(true);
			});
		});
	}
}
