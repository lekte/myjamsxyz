const express = require('express');
const request = require('request');
const cors = require('cors');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 10000;

const CLIENT_ID = process.env.CLIENT_ID || "32315d9f0a964ac98cd07ec151102cb8";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "602973493d63487987b4f81a1389a6df";
const REDIRECT_URI = process.env.REDIRECT_URI || "https://myjams.onrender.com/callback";

// In-memory storage for demonstration purposes
const users = {};

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/login', (req, res) => {
    const scopes = 'user-read-private user-read-email playlist-modify-public user-top-read';
    res.redirect('https://accounts.spotify.com/authorize' +
      '?response_type=code' +  // Change from token to code
      '&client_id=' + CLIENT_ID +
      '&scope=' + encodeURIComponent(scopes) +
      '&redirect_uri=' + encodeURIComponent(REDIRECT_URI));
  });


  app.get('/callback', (req, res) => {
    const code = req.query.code || null;
    if (!code) {
      res.redirect('/#' +
        querystring.stringify({
          error: 'invalid_code',
        }));
      return;
    }
  
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
      if (error || response.statusCode !== 200) {
        console.error('Failed to get access token:', error || body.error);
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token',
          }));
        return;
      }
  
      const access_token = body.access_token;
      const refresh_token = body.refresh_token;
  
      console.log('Access Token:', access_token);
  
      const userProfileOptions = {
        url: 'https://api.spotify.com/v1/me',
        headers: {
          'Authorization': 'Bearer ' + access_token,
        },
        json: true,
      };
  
      request.get(userProfileOptions, (error, response, body) => {
        if (error) {
          console.error('Failed to get user profile:', error);
          res.redirect('/#' +
            querystring.stringify({
              error: 'invalid_token',
            }));
          return;
        }
  
        if (response.statusCode !== 200) {
          console.error('Failed to get user profile:', body.error);
          res.redirect('/#' +
            querystring.stringify({
              error: 'invalid_token',
            }));
          return;
        }
  
        const user_id = body.id;
  
        if (body.scope && (!body.scope.includes('user-read-private') || !body.scope.includes('user-read-email'))) {
          console.error('Access token does not have the necessary scopes');
          res.redirect('/#' +
            querystring.stringify({
              error: 'insufficient_scopes',
            }));
          return;
        }
  
        users[user_id] = {
          access_token,
          refresh_token,
        };
  
        createPlaylist(user_id, 'short_term');
  
        const uri = process.env.FRONTEND_URI || 'https://myjams.onrender.com/confirmation.html';
        res.redirect(uri + '#access_token=' + access_token);  // Change from query parameter to fragment
      });
    });
  });
  

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

cron.schedule('0 0 25 * *', () => {
  // This code will run on the 25th day of every month at 00:00
  for (const user_id in users) {
    createPlaylist(user_id, 'medium_term');
  }
});

function createPlaylist(userId, timeRange) {
  const { access_token } = users[userId];

  // Use the Spotify Web API to get the user's top tracks
  const options = {
    url: `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=12`,
    headers: {
      'Authorization': 'Bearer ' + access_token,
    },
    json: true,
  };

  request.get(options, (error, response, body) => {
    if (error || response.statusCode !== 200) {
      console.error('Failed to get top tracks:', error || body.error);
      return;
    }

    const topTracks = body.items;
    const date = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const playlistName = `My ${monthName} Top 12, ${year}`;

    const playlistOptions = {
      url: `https://api.spotify.com/v1/users/${userId}/playlists`,
      headers: {
        'Authorization': 'Bearer ' + access_token,
      },
      json: true,
      body: {
        name: playlistName,
        public: true,
      },
    };

    request.post(playlistOptions, (error, response, body) => {
      if (error || response.statusCode !== 201) {
        console.error('Failed to create playlist:', error || body.error);
        return;
      }

      const playlistId = body.id;
      const trackUris = topTracks.map(track => track.uri);
      const addTracksOptions = {
        url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        headers: {
          'Authorization': 'Bearer ' + access_token,
        },
        json: true,
        body: {
          uris: trackUris,
        },
      };

      request.post(addTracksOptions, (error, response, body) => {
        if (error || response.statusCode !== 201) {
          console.error('Failed to add tracks to playlist:', error || body.error);
          return;
        }

        console.log('Playlist created successfully!');
      });
    });
  });
}
