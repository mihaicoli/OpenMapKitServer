'use strict';

var settings;

try {
    settings = require('./settings');
} catch (e) {
    console.error("You must have a settings.js file. Take a look at settings.js.example. https://github.com/AmericanRedCross/OpenMapKitServer/blob/master/settings.js.example");
    process.exit();
}

const express = require('express');
const directory = require('serve-index');
const cors = require('cors');
const odk = require('./odk/odk-routes');
const deployments = require('./deployments/deployment-routes');
const error = require('./odk/controllers/error-handler');
const pkg = require('./package');
const app = express();

// Enable CORS always.
app.use(cors());

// Basic Info
app.get('/', info);
app.get('/info', info);

// Deployments
app.use('/deployments', deployments);

// Open Data Kit
app.use('/odk', odk);

// Public Data & Static Assets
app.use('/public', express.static(settings.publicDir));
app.use('/public', directory(settings.publicDir));

// Handle errors
app.use(error);

module.exports = app;

function info(req, res) {
    res.status(200).json({
        name: settings.name,
        description: settings.description,
        status: 200,
        service: pkg.name,
        version: pkg.version
    });
}