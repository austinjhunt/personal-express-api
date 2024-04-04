const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

// Load client secrets from a local file
const CLIENT_SECRET_FILE = path.join(__dirname, 'secret', 'gmail-oauth-client.json');
const { client_secret, client_id, redirect_uris, refresh_token, allowed_origins } = JSON.parse(fs.readFileSync(CLIENT_SECRET_FILE)).web;
const oauth2Client = new OAuth2(
    client_id, client_secret, process.env.NODE_ENV === 'production' ? redirect_uris.production : redirect_uris.development
);

const app = express();
const port = process.env.PORT || 3001;

app.use((req, res, next) => {
    //logging middleware
    var origin;
    try {
        origin = req.header('origin').toLowerCase() || 'none';
    } catch (error) {
        origin = 'none';
    }
    console.log({
        'action': 'request',
        'method': req.method,
        'path': req.path,
        'body': req.body,
        'origin': origin,
        'headers': req.headers,
    });
    next();
});

app.use((req, res, next) => {
    var origin;
    try {
        origin = req.header('origin').toLowerCase() || 'none';
    } catch (error) {
        origin = 'none';
    }
    if (allowed_origins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(bodyParser.json());


// Function to refresh the access token
async function refreshAccessToken() {
    oauth2Client.setCredentials({
        refresh_token: refresh_token
    });
    const { token } = await oauth2Client.getAccessToken();
    return token;
}


async function sendEmail({ subject, body, from_email, from_name, recipient }) {
    // Obtain user credentials to use for the request
    const authClient = new google.auth.JWT({
        keyFile: path.join(__dirname, './email-automator-expressjs-3d7a18eb96e6.json'),
        scopes: [
            'https://www.googleapis.com/auth/gmail.send'
        ],
    });
    const accessToken = await refreshAccessToken();
    authClient.setCredentials({
        access_token: accessToken
    });

    const gmail = google.gmail({
        auth: authClient,
        version: 'v1'
    });
    // You can use UTF-8 encoding for the subject using the method below.
    // You can also just use a plain string if you don't need anything fancy.
    const subjectPretty = `🤘 ${subject} 🤘`;
    const utf8Subject = `=?utf-8?B?${Buffer.from(subjectPretty).toString('base64')}?=`;
    const messageParts = [
        `From: ${from_name} <${from_email}>`,
        `To: Austin Hunt <${recipient}>`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
    ];
    const message = messageParts.join('\n');

    // The body needs to be base64url encoded.
    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
            raw: encodedMessage,
        },
    });
    console.log(res.data);
    return res.data;
}


// USE THESE ENDPOINTS TO MANUALLY OBTAIN A REFRESH TOKEN ON INITIAL SETUP.
// YOU CAN THEN USE THE REFRESH TOKEN TO OBTAIN ACCESS TOKENS AS NEEDED. (refresh_token in the json file)
// start oauth flow 
app.get('/login-google', async (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: 'https://www.googleapis.com/auth/gmail.send'
    });
    // redirect to authUrl
    res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    oauth2Client.getToken(req.query.code, (err, tokens) => {
        if (err) {
            console.error('Error getting oAuth tokens:', err);
            res.status(500).send({
                error: 'Error getting oAuth tokens',
                errorDetail: err.toString(),
            });
            return;
        }
        console.log({
            'action': 'oauth2callback',
            'code': code,
            'tokens': tokens,
        });
        res.send({
            tokens: tokens
        });
    });
});



app.post('/send-email', async (req, res) => {
    console.log({
        'action': 'send-email',
        'body': req.body,
        'origin': req.header('origin').toLowerCase() || 'none',
        'headers': req.headers,
    });
    const { subject, body, from_email, from_name, recipient } = req.body;
    try {
        await sendEmail({ subject: subject, body: body, from_email: from_email, from_name: from_name, recipient: recipient });
        res.send({
            message: 'Email sent successfully',
            body: body,
            subject: subject,
            from_email: from_email,
            from_name: from_name,
            recipient: recipient,
        });

    } catch (error) {
        console.error('Failed to send email:', error);
        res.status(500).send({
            error: 'Failed to send email',
            errorDetail: error.toString(),
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port} with environment ${process.env.NODE_ENV}`);
});