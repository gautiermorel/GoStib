/* NPM modules */
const dotenv = require('dotenv').config()

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const moment = require('moment');

const { CronJob } = require('cron');

/* Custom modules */
const app = express();

if (dotenv.error) console.log('WARNING: index.js - Unable to load dotenv files');
const { CRON_PATTERN = '0 20 * * *', PORT = 8000, DARWIN_TO_SCHAERBEEK = '5063', RECIPIENT_ID = '2195253467206298' } = process.env;

const STIB = require('./stib');
const Messenger = require('./messenger');
const Helpers = require('./helpers');

let stib = new STIB();
let messenger = new Messenger();
let helpers = new Helpers();

app.use(compression());
app.set('case sensitive routing', true);
app.use(bodyParser.json());

app.get('/', async (req, res) => {
	res.send(`
	<html>
		<p>STIB Bot</p>
	</html>
	`);
	// let access_token;

	// let darwin_schaerbeek = '5063';
	// let darwin_fort_jaco = '5021';

	// access_token = await stib.init();

	// let dfc;
	// let ds;
	// dfc = await stib.getPassingTimeByPoint(access_token, darwin_fort_jaco);
	// ds = await stib.getPassingTimeByPoint(access_token, darwin_schaerbeek);

	// let [nextDfc, upcommingDfc] = dfc;
	// let [nextDs, upcommingDs] = ds;


	// let now = moment();

	// res.send(`
	// 	<html>
	// 		<h1>STIB: Darwin stop</h1>
	// 		<p><b>${nextDfc.destination.fr}: </b><span>${nextDfc.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(nextDfc.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
	// 		<p><b>${upcommingDfc.destination.fr}: </b><span>${upcommingDfc.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(upcommingDfc.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
	// 		<br/>
	// 		<br/>
	// 		<p><b>${nextDs.destination.fr}: </b><span>${nextDs.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(nextDs.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
	// 		<p><b>${upcommingDs.destination.fr}: </b><span>${upcommingDs.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(upcommingDs.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
	// 		<br/>
	// 		<br/>
	// 	</html>
	// `);
});

app.get('/webhook/', async (req, res) => {
	messenger.handleVerify(req, res)
});

app.post('/webhook/', (req, res) => {
	messenger.receiveMessage(req, res)
});

const httpServer = http.createServer(app);

httpServer.listen(PORT, () => {
	console.log('Express http server listening on port ', PORT);
});

const job = new CronJob({
	cronTime: CRON_PATTERN,
	onTick: async () => {
		let start = moment();
		let end = moment().add(1, 'hour');

		console.log('INFO: index.js#onTick - Start:', start.toDate());

		let token;
		try { token = await stib.init() }
		catch (error) {
			console.log('ERROR: index.js#onTick - Cannot generate access_token from STIB:', error);
			return false;
		}

		let { access_token = null, expires_in = null } = token || {};

		if (!access_token || !expires_in) {
			console.log('ERROR: index.js#onTick - No access_token or expirin_in found')
			return false;
		}

		let renewToken = moment().add(expires_in, 'millisecond');

		console.log('INFO: index.js#onTick - expires_in=', expires_in, '| Need to be renew at:', renewToken.toDate());

		while (moment().isBefore(renewToken)) {

			console.log('moment()=', moment());
			console.log('renew=', renewToken);

			setTimeout(async () => {
				// Now checking time for DARWIN_TO_SCHAERBEEK.
				let passingTimes;
				try { passingTimes = await stib.getPassingTimeByPoint(access_token, DARWIN_TO_SCHAERBEEK) }
				catch (error) {
					console.log('ERROR: index.js#onTick - Unable to get passing time by point:', error);
					return false;
				}

				let [nextTram, upcommingTram] = passingTimes || [];

				if (!nextTram || !upcommingTram) {
					console.log('ERROR: index.js#onTick - No available informations returned');
					return false;
				}

				let { expectedArrivalTime = null } = nextTram;

				if (!expectedArrivalTime) {
					console.log('ERROR: index.js#onTick - No available expectedArrivalTime returned');
					return false;
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
			}, 20000);
		}

		if (moment().isBefore(end)) return this.requesting();

		console.log('INFO: index.js#onTick - End of this range, will wait till the next one');

		return true;
	},
	runOnInit: true,
	start: false
});

job.start();
