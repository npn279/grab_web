require('dotenv').config()
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
var Handlebars = require('handlebars')
// DB
var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGODB_URI

// ROUTES
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var loginRoute = require('./routes/login')
var dataRoute = require('./routes/data')
var registerRoute = require('./routes/register');
const bodyParser = require('body-parser');


var app = express();

// SESSION
app.use(session({
	secret: 'my-secret-key',
	resave: false,
	saveUninitialized: true,
	cookie: {
		maxAge: 60000 * 10 // 10 minutes
	}
}));


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: false}));

let client
MongoClient.connect(url, { useUnifiedTopology: true })
	.then(_client => {
		client = _client
		console.log('Connected to mongodb');
		const db = client.db('Bootcamp')
		app.locals.db = db

		app.use('/', indexRouter);
		app.use('/users', usersRouter);
		app.use('/login', loginRoute);
		app.use('/data', dataRoute);
		app.use('/register', registerRoute)

		// catch 404 and forward to error handler
		app.use(function (req, res, next) {
			next(createError(404));
		});

		// error handler
		app.use(function (err, req, res, next) {
			// set locals, only providing error in development
			res.locals.message = err.message;
			res.locals.error = req.app.get('env') === 'development' ? err : {};

			// render the error page
			res.status(err.status || 500);
			res.render('error');
		});
	})
	.catch(error => {
		console.log('Error connecting to the Mongodb', error);
	})

module.exports = app;