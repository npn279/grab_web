var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
	return res.render('login', { 'title': 'Login' })
});

router.post('/', async (req, res) => {
	let loginUser = req.body.loginUser
	let loginPassword = req.body.loginPassword

	const db = req.app.locals.db
	const USER = db.collection('USER')

	if (loginUser.trim() === '' || loginUser === null) {
		err = 'Please enter username!'
	} else if (loginPassword.trim() === '' || loginPassword === null) {
		err = 'Please enter password!'
	} else {
		let user = await USER.findOne({ '_id': loginUser, 'password': loginPassword })
		if (!user) {
			err = 'Username or password is incorrect!'
		} else if (user.type !== 'admin') {
			err = 'Account is not admin!'
		} else if (user.type === 'admin') {
			req.session.user = user
			return res.redirect('/')
		}
	}

	return res.render('login', { title: 'Login', loginUser, err })
})

router.get('/logout', (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.log('Log out error!');
		} else {
			return res.redirect('/login')
		}
	})
})

module.exports = router;
