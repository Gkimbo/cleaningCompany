/* eslint-disable no-console */
/* eslint-disable no-unused-vars */

const express = require('express');

const router = new express.Router();

const clientRoutes = ['/'];
// const authedClientRoutes = ['/profile'];

// router.get(authedClientRoutes, (req, res) => {
//     if (req.user) {
//         res.sendFile(getClientIndexPath());
//     } else {
//         res.redirect('/user-sessions/new');
//     }
// });

router.get(clientRoutes, (req, res) => {
  console.log('Hello from the client folder');
  res.send('<h1>this worked<h1>');
});

module.exports = router;
