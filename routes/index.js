var express = require('express');
var router = express.Router();

router.get('/', (req, res) => {
    if (req.session.user) {
        let user = req.session.user

        // GENERATE GREETING
        let greeting = undefined
        let hour = getHour()

        if (hour < 12) {
            greeting = `Good morning, ${user.name}!`
        } else if (hour < 18) {
            greeting = `Good afternoon, ${user.name}!`
        } else {
            greeting = `Good evening, ${user.name}!`
        }

        return res.render('index', {greeting, 'title': 'Welcome ' + user.name})
    }
    else {
        res.redirect('/login')
    }
})

function getHour() {
    // get current hour
    let now = new Date()
    let options = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }
    let vnHour = now.toLocaleString('en-US', options).split(', ')[1].split(':')[0]
    return parseInt(vnHour)
}

module.exports = router;
