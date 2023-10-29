const express = require('express');
const request = require('request');
const cors = require('cors');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 3002;

const CLIENT_ID = '32315d9f0a964ac98cd07ec151102cb8';
const CLIENT_SECRET = '602973493d63487987b4f81a1389a6df';
const REDIRECT_URI = 'https://myjams.onrender.com/callback';

// In-memory storage for demonstration purposes
const users = {};

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/login', (req, res) => {
  const scopes = 'user-read-private user-read-email playlist-modify-public user-top-read';
  res.redirect('https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + CLIENT_ID +
    '&scope=' + encodeURIComponent(scopes) +
    '&redirect_uri=' + encodeURIComponent(REDIRECT_URI));
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
      'Authorization': 'Basic ' + (new Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
    },
    json: true,
  };

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      const refresh_token = body.refresh_token;
      const user_id = body.user_id;

      // Store access token and refresh token in user storage
      users[user_id] = {
        access_token,
        refresh_token,
      };

      const uri = 'https://myjams.onrender.com';
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

cron.schedule('0 0 1 * *', () => {
  // This code will run on the 1st day of every month at 00:00
  createPlaylist();
});

function createPlaylist() {
    // Iterate over all users and create a playlist for each user
    for (const user_id in users) {
      const { access_token, refresh_token } = users[user_id];
  
      // Use the Spotify Web API to get the user's top tracks
      const options = {
        url: 'https://api.spotify.com/v1/me/top/tracks',
        headers: {
          'Authorization': 'Bearer ' + access_token,
        },
        json: true,
      };
  
      request.get(options, (error, response, body) => {
        if (response.statusCode === 401 && body.error.message === 'The access token expired') {
          // Access token has expired, refresh it
          const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
              grant_type: 'refresh_token',
              refresh_token: refresh_token,
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
            },
            json: true,
          };
  
          request.post(authOptions, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              const newAccessToken = body.access_token;
  
              // Update the stored access token
              users[user_id].access_token = newAccessToken;
  
              // Retry creating the playlist with the new access token
              createPlaylist();
            } else {
              console.error('Failed to refresh access token:', error || body.error);
            }
          });
        } else if (!error && response.statusCode === 200) {
          const topTracks = body.items.slice(0, 12);
          const playlistOptions = {
            url: 'https://api.spotify.com/v1/users/' + user_id + '/playlists',
            headers: {
              'Authorization': 'Bearer ' + access_token,
            },
            json: true,
            body: {
              name: 'Month Name Album Year',
              public: true,
            },
          };
  
          request.post(playlistOptions, (error, response, body) => {
            if (!error && response.statusCode === 201) {
              const playlistId = body.id;
              const trackUris = topTracks.map(track => track.uri);
              const addTracksOptions = {
                url: 'https://api.spotify.com/v1/playlists/' + playlistId + '/tracks',
                headers: {
                  'Authorization': 'Bearer ' + access_token,
                },
                json: true,
                body: {
                  uris: trackUris,
                },
              };
  
              request.post(addTracksOptions, (error, response, body) => {
                if (!error && response.statusCode === 201) {
                  console.log('Playlist created successfully!');
                } else {
                  console.error('Failed to add tracks to playlist:', error || body.error);
                }
              });
            } else {
              console.error('Failed to create playlist:', error || body.error);
            }
          });
        } else {
          console.error('Failed to get top tracks:', error || body.error);
        }
      });
    }
  }
  