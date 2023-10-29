const express = require('express');
const request = require('request');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/login', (req, res) => {
  const scopes = 'user-read-private user-read-email playlist-modify-public user-top-read';
  res.redirect('https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + "32315d9f0a964ac98cd07ec151102cb8" +
    '&scope=' + encodeURIComponent(scopes) +
    '&redirect_uri=' + encodeURIComponent("http://localhost:3000/callback"));
});

app.get('/callback', (req, res) => {
  const code = req.query.code || null;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer.from("32315d9f0a964ac98cd07ec151102cb8" + ':' + "602973493d63487987b4f81a1389a6df").toString('base64')),
    },
    json: true,
  };

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      const uri = FRONTEND_URI || 'http://localhost:3000';
      res.redirect(uri + '?access_token=' + access_token);
    } else {
      res.redirect('/#' +
        querystring.stringify({
          error: 'invalid_token',
        }));
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const cron = require('node-cron');

cron.schedule('0 0 1 * *', () => {
  // This code will run on the 1st day of every month at 00:00
  createPlaylist();
});

function createPlaylist() {
  // Implement the logic to create a playlist of your top 12 most listened-to songs
  // and name it "Month Name Album Year"
}

app.listen(port, () => {
    console.log(`server started on port ${PORT}`);
  });