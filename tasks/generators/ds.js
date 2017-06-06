var request = require("request");
// var querystring = require('qs');
// var syncRequest = require('sync-request');
var _ = require("underscore");
var _string = require("underscore.string");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";  // to ignore self-signed ssl
var fs = require('fs');
//var urlencode = require('urlencode');
var cheerio = require('cheerio');
var json2xls = require('json2xls');

process.on('uncaughtException', errandshutdown);
function errandshutdown(err) {
  p(JSON.stringify(err.stack));
}

var p = function (el) {
  var x = new Error().stack;
  var stack = x.split("\n");
  var caller = _string.trim(stack[2]);
  console.log("Debugging file " + caller);
  console.log(el);
}


function ApiProcessor(options, callback) {
  this.params = options;

  var host = "www.cpso.on.ca";
  var port = "80";

  this.urlBase = "http://" + host;
  this.cookie = null;

  this.callback = callback;

  this.cookies = null;

  this.idDoctorAr = [];
}

var prot = ApiProcessor.prototype;

exports = module.exports = function (options, callback) {
  console.log("inside task");
  var proc = new ApiProcessor(options, callback);
  proc.run();
  //proc.mock();
  //proc.mockDoctor();
}

prot.run = function () {
  var self = this;

  self.loadForm(function (body) {
    self.getPage(self.resultHandler, body, self.params, true);
  });
}

prot.mockDoctor = function () {
  var doctor = {};

  fs.readFile('/Users/yuriskomorovsky/projects/doctor.html', 'utf8', function (err, data) {
    if (err) {
      return console.log(err);
    }
    $ = cheerio.load(data);
    var sections = $('#profile-content');

    if (sections.length != 4) {
      console.log("ERROR. sections length is not correct");
    }

    var section1 = sections.eq(0);
    var detailsSection1 = section1.find("div[class=detail]");
    var section2 = sections.eq(1);
    var detailsSection2 = section2.find("div[class=detail]");
    var section3 = sections.eq(2);
    var detailsSection3 = section3.find("div[class=detail]");
    var section4 = sections.eq(3);
    var detailsSection4 = section4.find("div[class=detail]");


    // doctor information
    var infoMap = {
      "Given Name:": "firstname",
      "Surname:": "lastname",
      "Gender:": "gender",
      "Language Fluency:": "language"
    }
    var detObj = detailsSection1.eq(0);
    var detStr = detObj.find("p").text();
    var detAr = detStr.split(/\s{2,}/g)
      .filter(function (val) {
        return val
      }); // filter out empty vals
    for (var i = 0; i < detAr.length; i += 2) {
      var key = detAr[i];
      if (infoMap[key]) {
        doctor[infoMap[key]] = detAr[i + 1];
      }
    }

    // Primary Practice Location
    var detObj = detailsSection1.eq(1);
    var detStr = detObj.find("p").html();

    //detStr = detStr.replace("<br>", " ");
    var detAr = detStr.trim().split(/\s{2,}/g).filter(function (val) {
      return val && (val != "<br>")
    })
    if (detAr.length != 2) {
      console.log("ERROR. practice location length is not correct");
    }
    var loc = detAr[0];
    var contacts = detAr[1];
    var phonePattern = /Phone:(&#xA0;)?([\+\(\)\d\-\s]+)/
    var faxPattern = /Fax:(&#xA0;)?([\+\(\)\d\-\s]+)/
    var matchesP = phonePattern.exec(contacts);
    if (matchesP) {
      doctor.phone = matchesP[2];
    }
    var matchesF = faxPattern.exec(contacts);
    if (matchesF) {
      doctor.fax = matchesF[2];
    }

    var locAr = loc.split("<br>");
    var locLast = locAr.pop();
    locLastAr = locLast.split("&#xA0;").filter(function (val) {
      return val
    }); // filter out empty vals

    if (locLastAr.length != 3) {
      console.log("ERROR. loclast length is not correct");
    }
    doctor.city = locLastAr[0] ? locLastAr[0] : '';
    doctor.province = locLastAr[1] ? locLastAr[1] : '';
    doctor.postal = locLastAr[2] ? locLastAr[2] : '';
    doctor.address = locAr.join(", ");


    // Current Registration
    var detObj = detailsSection1.eq(2);
    var detStr = detObj.find("p").text();
    var detAr = detStr.split(/\s{2,}/g)
      .filter(function (val) {
        return val
      }); // filter out empty vals
    if (detAr[0] == 'Registration Class:') {
      doctor['Registration Class'] = detAr[1];
    }

    // Specialties
    var detObj = detailsSection1.eq(3);
    var specialties = [];
    detObj.find("tr").each(function (i, elem) {
      if (i > 0) {
        var tr = $(this).text();
        var detAr = tr.split(/\s{2,}/g)
          .filter(function (val) {
            return val
          }); // filter out empty vals
        if (detAr.length) {
          specialties.push(detAr[0]);
        }
      }
    })
    doctor.specialties = specialties.join(", ");

    // Secondary address
    var h2List = section2.find("h2");
    h2 = h2List.eq(1);
    if (h2.text().trim() == "Secondary Practice Location") {
      var detObj = detailsSection2.eq(1);
      var detStr = detObj.find("p").html();

      if (detStr.indexOf('Canada') > -1) {
        detStr = detStr.replace('Canada', "  ");
      }

      var detAr = detStr.trim().split(/\s{2,}/g).filter(function (val) {
        return val && (val != "<br>")
      })

      var loc = detAr[0];
      var contacts = detAr[1];
      var phonePattern = /Phone:(&#xA0;)?([\+\(\)\d\-\s]+)/
      var faxPattern = /Fax:(&#xA0;)?([\+\(\)\d\-\s]+)/
      var matchesP = phonePattern.exec(contacts);
      if (matchesP) {
        doctor['Secondary Phone'] = matchesP[2];
      }
      var matchesF = faxPattern.exec(contacts);
      if (matchesF) {
        doctor['Secondary Fax'] = matchesF[2];
      }

      var locAr = loc.split("<br>").filter(function (val) {
        return val && (val != "<br>")
      });

      var locLast = locAr.pop();
      locLastAr = locLast.split("&#xA0;").filter(function (val) {
        return val
      }); // filter out empty vals

      if (locLastAr.length != 3) {
        console.log("ERROR. loclast length is not correct");
      }
      doctor['Secondary City'] = locLastAr[0] ? locLastAr[0] : '';
      doctor['Secondary Province'] = locLastAr[1] ? locLastAr[1] : '';
      doctor['Secondary Postal'] = locLastAr[2] ? locLastAr[2] : '';
      doctor['Secondary Address'] = locAr.join(", ");
    }


    p(doctor);


  });
}

prot.mock = function () {
  var idDoctorAr = [];
  var self = this;
  var idPattern = /id=(%?[\d]+)$/
  fs.readFile('/Users/yuriskomorovsky/projects/test.html', 'utf8', function (err, data) {
    if (err) {
      return console.log(err);
    }
    $ = cheerio.load(data);
    $('#results').find('a[class=doctor]').each(function (i, elem) {
      var href = $(this).attr('href');
      var matches = idPattern.exec(href);
      if (matches) {
        idDoctorAr.push(matches[1]);
      } else {
        p("couldn't get id from " + href);
      }
    });

    //p(idDoctorAr);
    scrapeDoctors.call(self, idDoctorAr)
  });
}

async function scrapeDoctors(idDoctorAr) {
  var chunkSize = 3;

  var chunks = [];

  while (idDoctorAr.length > 0) {
    chunks.push(idDoctorAr.splice(0, chunkSize));
  }

  console.log("total request chunks: " + chunks.length);

  var resAr = [];
  for (var k in chunks) {
    console.log("perfoming chunk " + (parseInt(k) + 1) + "/" + chunks.length);
    var ids = chunks[k];
    try {
      var res = await this.doChunkedRequests(ids);
    } catch (err) {
      console.log("ERROR: chunkedRequest " + JSON.stringify(err));
    }
    resAr = resAr.concat(res);
    console.log("done.");
  }

  return resAr;
}

prot.doChunkedRequests = function (ids) {
  var promises = [];
  for (var k in ids) {
    var id = ids[k];
    promises.push(this.doctorScrape(id));
  }

  return Promise.all(promises).then(function (resAr) {
    return resAr;
  })
}

prot.doctorScrape = function (id) {
  var url = "http://www.cpso.on.ca/public-register/doctor-details-print.aspx?view=9&id=" + id;
  var self = this;

  return new Promise(function (resolve, reject) {
    request(url, function (err, response, body) {
      if (err) {
        console.log(err);
        return reject(err);
      }

      var doc = self.doctorParse(id, body);
      p("received doctor " + JSON.stringify(doc));
      return resolve(doc);
    })
  });
  // return Promise.resolve(id).then(function (id) {
  //   return {id: id};
  // })
}

prot.doctorParse = function (id, data) {
  var doctor = {
    id: id,
    firstname: '',
    lastname: '',
    language: '',
    gender: '',
    phone: '',
    fax: '',
    address: '',
    city: '',
    province: '',
    postal: '',
    'Registration Class': '',
    specialties: '',
    'Secondary Address': '',
    'Secondary Phone': '',
    'Secondary Fax': '',
    'Secondary Postal': '',
    'Secondary City': '',
    'Secondary Province': '',

  };


  console.log("Parsing id " + id);

  $ = cheerio.load(data);
  var sections = $('#profile-content');

  if (sections.length != 4) {
    console.log("ERROR. sections length is not correct");
  }

  var section1 = sections.eq(0);
  var detailsSection1 = section1.find("div[class=detail]");
  var section2 = sections.eq(1);
  var detailsSection2 = section2.find("div[class=detail]");
  var section3 = sections.eq(2);
  var detailsSection3 = section3.find("div[class=detail]");
  var section4 = sections.eq(3);
  var detailsSection4 = section4.find("div[class=detail]");


  // doctor information
  var infoMap = {
    "Given Name:": "firstname",
    "Surname:": "lastname",
    "Gender:": "gender",
    "Language Fluency:": "language"
  }
  var detObj = detailsSection1.eq(0);
  var detStr = detObj.find("p").text();
  var detAr = detStr.split(/\s{2,}/g)
    .filter(function (val) {
      return val
    }); // filter out empty vals
  for (var i = 0; i < detAr.length; i += 2) {
    var key = detAr[i];
    if (infoMap[key]) {
      doctor[infoMap[key]] = detAr[i + 1];
    }
  }

  // Primary Practice Location
  var detObj = detailsSection1.eq(1);
  var detStr = detObj.find("p").html();

  //detStr = detStr.replace("<br>", " ");
  var detAr = detStr.trim().split(/\s{2,}/g).filter(function (val) {
    return val && (val != "<br>")
  })
  if (detAr.length != 2) {
    console.log("ERROR. practice location length is not correct");
  }
  var loc = detAr[0];
  var contacts = detAr[1];
  var phonePattern = /Phone:(&#xA0;)?([\+\(\)\d\-\s]+)/
  var faxPattern = /Fax:(&#xA0;)?([\+\(\)\d\-\s]+)/
  var matchesP = phonePattern.exec(contacts);
  if (matchesP) {
    doctor.phone = matchesP[2];
  }
  var matchesF = faxPattern.exec(contacts);
  if (matchesF) {
    doctor.fax = matchesF[2];
  }

  var locAr = loc.split("<br>");
  var locLast = locAr.pop();
  locLastAr = locLast.split("&#xA0;").filter(function (val) {
    return val
  }); // filter out empty vals

  if (locLastAr.length != 3) {
    console.log("ERROR. loclast length is not correct");
  }
  doctor.city = locLastAr[0] ? locLastAr[0] : '';
  doctor.province = locLastAr[1] ? locLastAr[1] : '';
  doctor.postal = locLastAr[2] ? locLastAr[2] : '';
  doctor.address = locAr.join(", ");


  // Current Registration
  var detObj = detailsSection1.eq(2);
  var detStr = detObj.find("p").text();
  var detAr = detStr.split(/\s{2,}/g)
    .filter(function (val) {
      return val
    }); // filter out empty vals
  if (detAr[0] == 'Registration Class:') {
    doctor['Registration Class'] = detAr[1];
  }

  // Specialties
  var detObj = detailsSection1.eq(3);
  var specialties = [];
  detObj.find("tr").each(function (i, elem) {
    if (i > 0) {
      var tr = $(this).text();
      var detAr = tr.split(/\s{2,}/g)
        .filter(function (val) {
          return val
        }); // filter out empty vals
      if (detAr.length) {
        specialties.push(detAr[0]);
      }
    }
  })
  doctor.specialties = specialties.join(", ");

  // Secondary address
  var h2List = section2.find("h2");
  h2 = h2List.eq(1);
  if (h2.text().trim() == "Secondary Practice Location") {
    var detObj = detailsSection2.eq(1);
    var detStr = detObj.find("p").html();

    if (detStr.indexOf('Canada') > -1) {
      detStr = detStr.replace('Canada', "  ");
    }

    var detAr = detStr.trim().split(/\s{2,}/g).filter(function (val) {
      return val && (val != "<br>")
    })

    if (detAr.length != 2) {
      console.log("ERROR. practice location length is not correct");
    }
    var loc = detAr[0];
    var contacts = detAr[1];
    var phonePattern = /Phone:(&#xA0;)?([\+\(\)\d\-\s]+)/
    var faxPattern = /Fax:(&#xA0;)?([\+\(\)\d\-\s]+)/
    var matchesP = phonePattern.exec(contacts);
    if (matchesP) {
      doctor['Secondary Phone'] = matchesP[2];
    }
    var matchesF = faxPattern.exec(contacts);
    if (matchesF) {
      doctor['Secondary Fax'] = matchesF[2];
    }

    var locAr = loc.split("<br>").filter(function (val) {
      return val && (val != "<br>")
    });

    var locLast = locAr.pop();
    locLastAr = locLast.split("&#xA0;").filter(function (val) {
      return val
    }); // filter out empty vals

    if (locLastAr.length != 3) {
      console.log("ERROR. loclast length is not correct");
    }
    doctor['Secondary City'] = locLastAr[0] ? locLastAr[0] : '';
    doctor['Secondary Province'] = locLastAr[1] ? locLastAr[1] : '';
    doctor['Secondary Postal'] = locLastAr[2] ? locLastAr[2] : '';
    doctor['Secondary Address'] = locAr.join(", ");
  }

  return doctor;
}

prot.receivedIdsHandler = function (ids) {
  var self = this;

  if (!ids.length) {
    return self.callback("noresults");
  }

  scrapeDoctors.call(self, ids).then(function (resAr) {
    var xls = json2xls(resAr);

    var filepath = __dirname + '/data/' + self.getFilename();
    fs.writeFileSync(filepath, xls, 'binary');
    //p("done all");
    self.callback(filepath);
  })
}

prot.resultHandler = function (err, httpResponse, body) {
  var self = this;
  var idDoctorAr = [];
  var idPattern = /id=(%?[\d]+)$/;
  if (err) {
    console.log(err);
    return;
  }

  $ = cheerio.load(body);
  $('#results').find('a[class=doctor]').each(function (i, elem) {
    var href = $(this).attr('href');
    var matches = idPattern.exec(href);
    if (matches) {
      self.idDoctorAr.push(matches[1]);
    } else {
      p("couldn't get id from " + href);
    }
  });

  var nextButton = $('#p_lt_ctl03_pageplaceholder_p_lt_ctl03_CPSO_DoctorSearchResults_lnkNext');
  if (nextButton.length) {
    //idDoctorAr = idDoctorAr.concat(self.getPage(self.resultHandler, body));
    self.getPage(self.resultHandler, body)
  } else {
    self.receivedIdsHandler(self.idDoctorAr);
  }
}

prot.loadForm = function (callback) {
  var url = "http://www.cpso.on.ca/Public-Register/All-Doctors-Search";
  var self = this;
  console.log("loading form...");
  return request(url, function (err, response, body) {
    if (err) {
      console.log(err);
      callback(err);
      return;
    }

    var cookiesAr = response.headers['set-cookie'];
    var myCookiesAr = [];
    var pattern = /^[^;]+/;
    for (var k in cookiesAr) {
      var c = cookiesAr[k];
      var matches = pattern.exec(c);
      myCookiesAr.push(matches[0]);
    }
    self.cookies = myCookiesAr.join(";");
    console.log("done.");
    callback(body);
  })
}


prot.getPage = function (callback, body, params, isFirstPage) {
  var self = this;
  isFirstPage = isFirstPage || false;

  var payload = {
    "__EVENTTARGET": "p$lt$ctl03$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$lnkNext",
    'Referer': 'http://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results'
  };

  var url = "http://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results";

  if (isFirstPage && params) {
    url = "http://www.cpso.on.ca/Public-Register/All-Doctors-Search";

    payload = _.extend(payload, {
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$txtLastName": "",
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$grpGender": " ",
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddLanguage": "08",

      //"p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddCity": 1965,
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$grpDocType": "rdoDocTypeSpecialist",
      //"p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddSpecialist": 219,
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddSpecialist": params.spec || 219,
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$grpStatus": "rdoStatusActive",
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddCity": params.city || "Select -->",
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$txtPostalCode": params.postal || '',

      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddHospitalCity": "Select -->",
      "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddHospitalName": -1,

      __EVENTTARGET: "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$btnSubmit",
      Referer: 'http://www.cpso.on.ca/Public-Register/All-Doctors-Search'
    })
  }

  var vsPattern = /id="__VIEWSTATE" value="([^"]+)" \/>/g;
  var matches = vsPattern.exec(body);
  var viewstate = matches[1];

  var tokenPattern = /id="__CMSCsrfToken" value="([^"]+)" \/>/g;
  var matches = tokenPattern.exec(body);
  var token = matches[1];

  var sgPattern = /id="__VIEWSTATEGENERATOR" value="([^"]+)" \/>/g
  var matches = sgPattern.exec(body);
  var vsgenerator = matches[1];


  payload = _.extend(payload, {
    "manScript_HiddenField": "",
    "__CMSCsrfToken": token,
    "__EVENTARGUMENT": "",
    "lng": "en-CA",
    "__VIEWSTATEGENERATOR": vsgenerator,
    "__SCROLLPOSITIONX": 0,
    "__SCROLLPOSITIONY": 0,
    "p$lt$ctl00$SearchBox$txtWord": "Site Search",
    "__VIEWSTATE": viewstate
  });

  var options = {
    url: url,
    form: payload,
    //proxy:"http://127.0.0.1:8080",
    followAllRedirects: true,
    headers: {
      'Host': 'www.cpso.on.ca',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:53.0) Gecko/20100101 Firefox/53.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/x-www-form-urlencoded',
      "Cookie": self.cookies,
      'Connection': 'close',
      'Upgrade-Insecure-Requests': 1,
    }
  };

  // if (!isFirstPage) {
  //   options.proxy = "http://127.0.0.1:8081";
  // }

  request.post(options, function (err, httpResponse, body) {
    callback.call(self, err, httpResponse, body)
  });
}

prot.getNextPage = function (body, callback) {
  var self = this;
  var vsPattern = /id="__VIEWSTATE" value="([^"]+)" \/>/g;
  var matches = vsPattern.exec(body);
  var viewstate = matches[1];

  var tokenPattern = /id="__CMSCsrfToken" value="([^"]+)" \/>/g;
  var matches = tokenPattern.exec(body);
  var token = matches[1];

  var sgPattern = /id="__VIEWSTATEGENERATOR" value="([^"]+)" \/>/g
  var matches = sgPattern.exec(body);
  var vsgenerator = matches[1];

  var payload = {
    "manScript_HiddenField": "",
    "__CMSCsrfToken": token,
    "__EVENTTARGET": "p$lt$ctl03$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$lnkNext",
    "__EVENTARGUMENT": "",
    "lng": "en-CA",
    "__VIEWSTATEGENERATOR": vsgenerator,
    "__SCROLLPOSITIONX": 0,
    "__SCROLLPOSITIONY": 0,
    "p$lt$ctl00$SearchBox$txtWord": "Site Search",
    "__VIEWSTATE": viewstate
  }

  request.post({
    url: "http://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results",
    form: payload,
    //proxy:"http://127.0.0.1:8080",
    followAllRedirects: true,
    headers: {
      'Host': 'www.cpso.on.ca',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:53.0) Gecko/20100101 Firefox/53.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'http://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results',
      "Cookie": self.cookies,
      'Connection': 'close',
      'Upgrade-Insecure-Requests': 1,
    }
  }, callback);
}


prot.getFilename = function () {
  var spec = (this.params.spec ? this.params.spec + '' : '0');
  var city = (this.params.city ? this.params.city + '' : '0');
  var postal = (this.params.postal ? this.params.postal + '' : '0');
  return 'data_spec' + spec + '_city' + city + '_postal' + postal + '.xlsx';
}

prot.getFirstPage = function (params, body, callback) {

  var self = this;
  params.ddSpecialist = 134;


  var vsPattern = /id="__VIEWSTATE" value="([^"]+)" \/>/g;
  var matches = vsPattern.exec(body);
  var viewstate = matches[1];

  var tokenPattern = /id="__CMSCsrfToken" value="([^"]+)" \/>/g;
  var matches = tokenPattern.exec(body);
  var token = matches[1];

  var sgPattern = /id="__VIEWSTATEGENERATOR" value="([^"]+)" \/>/g
  var matches = sgPattern.exec(body);
  var vsgenerator = matches[1];

  var payload = {
    "manScript_HiddenField": "",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$txtLastName": "",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$grpGender": " ",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddLanguage": "08",

    //"p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddCity": 1965,
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$grpDocType": "rdoDocTypeSpecialist",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddSpecialist": 134,
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$grpStatus": "rdoStatusActive",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddCity": "Select -->",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$txtPostalCode": "",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddHospitalCity": "Select -->",
    "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddHospitalName": -1,

    "__VIEWSTATE": viewstate,
    "__VIEWSTATEGENERATOR": vsgenerator,
    "__CMSCsrfToken": token,

    "__EVENTTARGET": "p$lt$ctl03$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$btnSubmit",
    "lng": "en-CA",
    "p$lt$ctl00$SearchBox$txtWord": "Site Search",
    "__EVENTARGUMENT": "",
    "__SCROLLPOSITIONX": 0,
    "__SCROLLPOSITIONY": 0,
    "__LASTFOCUS": "",
  }

  request.post({
    url: "http://www.cpso.on.ca/Public-Register/All-Doctors-Search",
    form: payload,
    //proxy:"http://127.0.0.1:8080",
    followAllRedirects: true,
    headers: {
      'Host': 'www.cpso.on.ca',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:53.0) Gecko/20100101 Firefox/53.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'http://www.cpso.on.ca/Public-Register/All-Doctors-Search',
      "Cookie": self.cookies,
      'Connection': 'close',
      'Upgrade-Insecure-Requests': 1,
    }
  }, callback);

}
