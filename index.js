/* NPM modules */
const dotenv = require('dotenv').config()

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');

const moment = require('moment');

/* Custom modules */
const STIB = require('./stib');
const Messenger = require('./messenger');

let stib = new STIB();
let messenger = new Messenger();

const port = 8000;

const app = express();

if (dotenv.error) console.log('WARNING: index.js - Unable to load dotenv files');

app.use(compression());
app.set('case sensitive routing', true);
app.use(bodyParser.json());

app.get('/', async (req, res) => {
	let access_token;

	let darwin_schaerbeek = '5063';
	let darwin_fort_jaco = '5021';

	access_token = await stib.init();

	let dfc;
	let ds;
	dfc = await stib.getPassingTimeByPoint(access_token, darwin_fort_jaco);
	ds = await stib.getPassingTimeByPoint(access_token, darwin_schaerbeek);

	let [nextDfc, upcommingDfc] = dfc;
	let [nextDs, upcommingDs] = ds;


	let now = moment();

	res.send(`
		<html>
			<h1>STIB: Darwin stop</h1>
			<p><b>${nextDfc.destination.fr}: </b><span>${nextDfc.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(nextDfc.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
			<p><b>${upcommingDfc.destination.fr}: </b><span>${upcommingDfc.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(upcommingDfc.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
			<br/>
			<br/>
			<p><b>${nextDs.destination.fr}: </b><span>${nextDs.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(nextDs.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
			<p><b>${upcommingDs.destination.fr}: </b><span>${upcommingDs.expectedArrivalTime}</span> ===> <b>${Math.round(moment.duration(moment(upcommingDs.expectedArrivalTime).diff(now)).asMinutes())}min</b></p>
			<br/>
			<br/>
		</html>
	`);
});

app.get('/webhook/', messenger.handleVerify);
app.post('/webhook/', messenger.receiveMessage);

const httpServer = http.createServer(app);

httpServer.listen(port, () => {
	console.log('Express http server listening on port ', port);
});