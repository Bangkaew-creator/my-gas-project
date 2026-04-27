const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;

function readFile(name) {
  try {
    return fs.readFileSync(path.join(__dirname, name), 'utf8');
  } catch (e) {
    return '';
  }
}

function buildPage() {
  let html = readFile('Index.html');
  
  html = html.replace(/\<\?!= include\('Style'\); \?\>/g, readFile('Style.html'));
  html = html.replace(/\<\?!= include\('JavaScript'\); \?\>/g, readFile('JavaScript.html'));
  html = html.replace(/\<\?!= include\('JS_Public'\); \?\>/g, readFile('JS_Public.html'));
  html = html.replace(/\<\?!= include\('JS_Auth'\); \?\>/g, readFile('JS_Auth.html'));
  html = html.replace(/\<\?!= include\('JS_Member'\); \?\>/g, readFile('JS_Member.html'));
  html = html.replace(/\<\?!= include\('JS_Admin'\); \?\>/g, readFile('JS_Admin.html'));
  html = html.replace(/\<\?!= include\('JS_Stray'\); \?\>/g, readFile('JS_Stray.html'));
  html = html.replace(/\<\?!= include\('JS_Volunteer'\); \?\>/g, readFile('JS_Volunteer.html'));
  html = html.replace(/\<\?!= include\('JS_Config'\); \?\>/g, readFile('JS_Config.html'));
  html = html.replace(/\<\?!= include\('Sidebar'\); \?\>/g, readFile('Sidebar.html'));

  html = html.replace(/<base target="_top">/g, '');

  const stub = `
<script>
(function() {
  var MOCK_DATA = {
    getPublicDashboardData: {
      households: 128,
      dogActual: 214,
      catActual: 97,
      totalActual: 311,
      vaccinated: 186,
      neutered: 142,
      vaccinationRate: 59.8,
      neuterRate: 45.7,
      dogPercentage: 68.8,
      catPercentage: 31.2,
      unvaccinatedPercentage: 40.2,
      dogTarget: 0,
      catTarget: 0,
      totalTarget: 0
    },
    getLostPetsPublic: { success: true, pets: [] },
    checkSession: null,
    getMemberDashboardData: {
      dogActual: 2, dogTarget: 0,
      catActual: 1, catTarget: 0,
      totalActual: 3, totalTarget: 0,
      vaccinated: 2,
      neutered: 1,
      currentTargets: [],
      profileData: { fullName: 'ทดสอบ', idCard: '0000000000000', phone: '0800000000' }
    },
    getAdminDashboardData: {
      success: true,
      cardData: {
        households: 128,
        dogActual: 214, dogTarget: 0,
        catActual: 97, catTarget: 0,
        totalActual: 311, totalTarget: 0,
        vaccinated: 186, neutered: 142
      },
      tableData: []
    },
    getStrayReports: { success: true, data: [] },
    getStrayData: { success: true, data: [] },
    getVolunteerData: { success: true, data: [] }
  };

  function makeRunner() {
    var _success = null;
    var _failure = null;
    var handler = {
      get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
          return function(fn) { _success = fn; return new Proxy({}, handler); };
        }
        if (prop === 'withFailureHandler') {
          return function(fn) { _failure = fn; return new Proxy({}, handler); };
        }
        return function() {
          var s = _success;
          var result = (prop in MOCK_DATA) ? MOCK_DATA[prop] : null;
          setTimeout(function() { if (s) s(result); }, 200);
        };
      }
    };
    return new Proxy({}, handler);
  }
  window.google = { script: { run: makeRunner() } };
})();
</script>
`;

  html = html.replace('<head>', '<head>' + stub);
  return html;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(buildPage());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
