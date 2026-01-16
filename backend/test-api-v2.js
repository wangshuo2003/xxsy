const http = require('http');

const searchType = '赛事';
const encodedType = encodeURIComponent(searchType);

const options = {
  hostname: 'localhost',
  port: 28964,
  path: `/api/activities?isApproved=true&type=${encodedType}`,
  method: 'GET'
};

console.log(`Requesting: ${options.path}`);

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Total items:', json.pagination ? json.pagination.total : 'N/A');
      if (json.data && json.data.length > 0) {
        console.log('First item type:', json.data[0].type);
      } else {
        console.log('No data returned');
      }
    } catch (e) {
      console.error('Error parsing JSON:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
