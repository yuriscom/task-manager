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


var stripTagsGentle = function (str) {
  return str.replace(/<\/?[^>]+>/g, '');
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
    //scrapeDoctors.call(self, idDoctorAr)
    self.scrapeDoctors(idDoctorAr);
  });
}

prot.scrapeDoctors = async function (idDoctorAr) {
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

prot.doctorScrape = function (idStr) {
  //http://www.cpso.on.ca/public-register/doctor-details-print.aspx?view=5&id=74173&ref-no=0139540
  //var url = "http://www.cpso.on.ca/public-register/doctor-details-print.aspx?view=9&id=" + id;
  //idStr = '0139540-74173';
  //idStr = '0288931-100187';

  let idAr = idStr.split('-');
  let id = idAr[1];
  let refNo = idAr[0];
  var url = `http://www.cpso.on.ca/public-register/doctor-details-print.aspx?view=5&id=${id}&ref-no=${refNo}`;
  var self = this;

  return new Promise(function (resolve, reject) {
    request(url, function (err, response, body) {
      if (err) {
        console.log(err);
        return reject(err);
      }

      var doc = self.doctorParse(idStr, body);
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


  // name
  var heading = $('#content div[class=heading]');

  headingH1 = heading.find('h1');
  let headingH1Txt = headingH1.text().trim();
  let headingH1TxtAr = headingH1Txt.split(/\r?\n/);
  if (headingH1TxtAr.length == 3) {
    let m = /^([^,]+),([^\\]+)/.exec(headingH1TxtAr[0]);
    doctor.firstname = m[2].trim();
    doctor.lastname = m[1].trim();
  }

  headingPAr = heading.find('div > p');
  let registrationRow = headingPAr.eq(1).html();
  var registrationPattern = /\s*.*>&#xA0;(.*)/
  var matchesR = registrationPattern.exec(registrationRow);
  if (matchesR) {
    doctor['Registration Class'] = matchesR[1];
  }

  var sectionSummary = $("section[data-jump-section=Summary]");
  var sectionPracticeInfo = $("section[data-jump-section='Practice Information']");
  var sectionSpecialties = $("section[data-jump-section=Specialties]");


  // summary
  var detailsSectionSummary = sectionSummary.find("div[class=info] > p");

  // gender
  let genderAr = detailsSectionSummary.eq(1).text().trim().split(/\r?\n/);
  if (genderAr.length == 2) {
    doctor.gender = genderAr[1].trim();
  }

  // languages
  let languagesAr = detailsSectionSummary.eq(2).text().trim().split(/\r?\n/);
  if (languagesAr.length == 2) {
    doctor.language = languagesAr[1].trim();
  }


  var phonePattern = /Phone:(&#xA0;|&nbsp;)?([\+\(\)\d\-\s]+)/
  var faxPattern = /Fax:(&#xA0;|&nbsp;)?([\+\(\)\d\-\s]+)/
  var cityRowPattern = /(.*)\s+ON\s*([\w][\d][\w]\s*[\d][\w][\d])/


  // Primary Practice Location
  let primaryAddressAr = [];
  var divPL = sectionPracticeInfo.find("div[class=practice-location]");
  let addrAr = divPL.html().split("<br>");
  for (let k in addrAr) {
    let row = addrAr[k].trim(/\r?\n/).trim().replace(/&#xA0;/g, ' ');
    //if (!row.length || row.startsWith("<")) {
    if (!row.length || k == 0) {
      continue;
    }

    row = stripTagsGentle(row);

    var matchesP = phonePattern.exec(row);
    var matchesF = faxPattern.exec(row);
    var matchesC = cityRowPattern.exec(row);

    if (matchesP) {
      doctor.phone = matchesP[2];
    } else if (matchesF) {
      doctor.fax = matchesF[2];
    } else {

      if (matchesC) {
        doctor.city = matchesC[1];
        doctor.postal = matchesC[2];
      }

      primaryAddressAr.push(row);
    }

  }
  doctor.address = primaryAddressAr.join(', ');


  // secondary address
  let secondaryAddressAr = [];
  var divPL1 = sectionPracticeInfo.find("div[class='additional-practice-location collapsible']").find("div[class=practice-location]");
  if (divPL1.children().length) {
    let addressesAr = divPL1.html().split("<hr>");
    if (addressesAr.length) {
      let addr = addressesAr[0];
      let addrAr = addr.split("<br>");
      for (let k in addrAr) {
        let row = addrAr[k].trim(/\r?\n/).trim().replace(/&#xA0;/g, ' ');
        if (!row.length || k == 0) {
          continue;
        }

        row = stripTagsGentle(row);

        var matchesP = phonePattern.exec(row);
        var matchesF = faxPattern.exec(row);
        var matchesC = cityRowPattern.exec(row);

        if (matchesP) {
          doctor['Secondary Phone'] = matchesP[2];
        } else if (matchesF) {
          doctor['Secondary Fax'] = matchesF[2];
        } else {

          if (matchesC) {
            doctor['Secondary City'] = matchesC[1];
            doctor['Secondary Postal'] = matchesC[2];
          }

          secondaryAddressAr.push(row);
        }

      }

      doctor['Secondary Address'] = secondaryAddressAr.join(', ');
    }
  }

  // Specialties
  let specialtiesTag = sectionSpecialties.find("table > tr");
  let specialtiesAr = [];
  specialtiesTag.each(function (i, elem) {
    let specAr = [];
    $(this).find('td').each(function (j, elem1) {
      specAr.push($(this).text().trim());
    })
    specialtiesAr.push(specAr.join(", "));
    //specialtiesAr.push($(this).find('td').eq(0).text());
  })
  doctor.specialties = specialtiesAr.join(", ");

  return doctor;
}

prot.receivedIdsHandler = function (ids) {
  var self = this;

  if (!ids.length) {
    return self.callback("noresults");
  }


  //scrapeDoctors.call(self, ids).then(function (resAr) {
  self.scrapeDoctors(ids).then(function (resAr) {
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
  //var idPattern = /id=(%?[\d]+)$/;
  // http://www.cpso.on.ca/DoctorDetails/Ryan-Francis-Aalders/0295403-103559
  var idPattern = /([\d]+\-[\d]+)$/;
  if (err) {
    console.log(err);
    return;
  }

  $ = cheerio.load(body);
  $('article h3 a').each(function (i, elem) {

    var href = $(this).attr('href');
    var matches = idPattern.exec(href);
    if (matches) {
      self.idDoctorAr.push(matches[1]);
    } else {
      p("couldn't get id from " + href);
    }
  });


  //var nextButton = $('#p_lt_ctl04_pageplaceholder_p_lt_ctl03_CPSO_DoctorSearchResults_lnkNext');
  var nextButtonParams = this.getNextButtonParams($);

  if (nextButtonParams) {
    //idDoctorAr = idDoctorAr.concat(self.getPage(self.resultHandler, body));
    self.getPage(self.resultHandler, body, nextButtonParams)
  } else {
    self.receivedIdsHandler(self.idDoctorAr);
  }
}

prot.getNextButtonParams = function ($) {
  let reg = /p_lt_ctl04_pageplaceholder_p_lt_ctl03_CPSO_DoctorSearchResults_rptPages_ctl([\d]+)_lnbPage/;

  let isNextChunkAvailable = ($('.doctor-search-paging a[class=next]').length > 0);
  nextChunkLink = 'p$lt$ctl04$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$lnbNextGroup';
  let curPage = $('#p_lt_ctl04_pageplaceholder_p_lt_ctl03_CPSO_DoctorSearchResults_hdnCurrentPage').val();

  let nextParams = null;
  if (isNextChunkAvailable) {
    nextParams = {
      __EVENTTARGET: nextChunkLink,
      "p$lt$ctl04$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$hdnCurrentPage": curPage
    };
  }

  let pagObj = $('.doctor-search-paging a[class=active]').next().get(0);
  if (!pagObj || !pagObj.attribs || !pagObj.attribs.id) {
    return nextParams;
  }

  if (pagObj.attribs.id.endsWith('LastPage')) {
    return nextParams
  }

  let match = reg.exec(pagObj.attribs.id);
  if (!match || match.length != 2) {
    return nextParams;
  }

  let num = match[1];
  let nextLink = `p$lt$ctl04$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$rptPages$ctl${num}$lnbPage`;

  return {
    __EVENTTARGET: nextLink,
    "p_lt_ctl04_pageplaceholder_p_lt_ctl03_CPSO_DoctorSearchResults_hdnCurrentPage": curPage
  };
}

prot.loadForm = function (callback) {
  //var url = "http://www.cpso.on.ca/Public-Register/All-Doctors-Search";
  var url = "http://www.cpso.on.ca/Public-Information-Services/Find-a-Doctor";
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


// START HERE
prot.getPage = function (callback, body, params, isFirstPage) {
  var self = this;
  isFirstPage = isFirstPage || false;

  var msPattern = /id="manScript_HiddenField" value="([^"]+)" \/>/g;
  var matches = msPattern.exec(body);
  //var mscript = matches[1];
  var mscript = ";;AjaxControlToolkit,+Version=4.1.60919.0,+Culture=neutral,+PublicKeyToken=28f01b0e84b6d53e:en-US:ee051b62-9cd6-49a5-87bb-93c07bc43d63:475a4ef5:effe2a26:7e63a579";


  var payload = {

    //"__EVENTTARGET": "p$lt$ctl04$pageplaceholder$p$lt$ctl04$CPSO_DoctorSearchResults$lnkNext",
    //'Referer': 'http://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results'
  };

  var url = "https://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results";


  if (isFirstPage && params) {
    url = "https://www.cpso.on.ca/Public-Register/All-Doctors-Search?refine=true&search=general";

    payload = _.extend(payload, {
      //"p$lt$ctl04$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$btnSubmit": "Submit",

      "__EVENTTARGET": "",
      "__LASTFOCUS":"",
      "searchType": "general",
      "p$lt$ctl01$SearchBox$txtWord": "",
      "p$lt$ctl01$SearchBox$txtWord_exWatermark_ClientState": "",


      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$advancedState": "open",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$ConcernsState": "closed",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$txtCPSONumber": "",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$txtLastNameQuick": "",



      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$txtLastName": "",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$grpGender": " ",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$ddLanguage": "08",

      //"p$lt$ctl04$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddCity": 1965,
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$grpDocType": params.spec == "001" ? "rdoDocTypeAll" : "rdoDocTypeSpecialist",
      //"p$lt$ctl04$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$ddSpecialist": 219,

      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$chkActiveDoctors": "on",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$chkPracticeRestrictions": "on",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$chkPendingHearings": "on",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$chkPastHearings": "on",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$chkHospitalNotices": "on",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$chkConcerns": "on",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$chkNotices": "on",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$txtExtraInfo": "",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$btnSubmit1": "Submit",
      //"p$lt$ctl04$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$grpStatus": "rdoStatusActive",

      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$ddHospitalCity": "",
      "p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$ddHospitalName": -1,

      //__EVENTTARGET: "p$lt$ctl04$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$btnSubmit",
      //Referer: 'http://www.cpso.on.ca/Public-Register/All-Doctors-Search'
      //Referer: 'http://www.cpso.on.ca/Public-Information-Services/Find-a-Doctor'
    })

    if (params.spec) {
      payload["p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$ddSpecialist"] = params.spec;
    }

    payload["p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$ddCity"] = "";
    payload["p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$txtPostalCode"] = "";

    if (params.city) {
      payload["p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$ddCity"] = params.city;
    } else if (params.postal) {
      payload["p$lt$ctl04$pageplaceholder$p$lt$ctl02$AllDoctorsSearch$txtPostalCode"] = params.postal;
    }


  } else if (params) {
    payload = _.extend(payload, params);
  } else {
    payload = _.extend(payload, {
      __EVENTTARGET: "p$lt$ctl04$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$lnkNext",
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
    "manScript_HiddenField": mscript,
    "__CMSCsrfToken": token,
    "__EVENTARGUMENT": "",
    "lng": "en-CA",
    "__VIEWSTATEGENERATOR": vsgenerator,
    "__SCROLLPOSITIONX": 0,
    "__SCROLLPOSITIONY": 0,
    //"p$lt$ctl01$SearchBox$txtWord": "Site Search",
    "p$lt$ctl01$SearchBox$txtWord": "",
    "p$lt$ctl01$SearchBox$txtWord_exWatermark_ClientState": "",
    "__VIEWSTATE": viewstate
  });

  var options = {
    url: `${url}`,
    form: payload,
    //proxy:"http://127.0.0.1:8080",
    followAllRedirects: true,
    headers: {
      'Host': 'www.cpso.on.ca',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:60.0) Gecko/20100101 Firefox/60.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/x-www-form-urlencoded',
      "Cookie": self.cookies,
      'Connection': 'close',
      'Upgrade-Insecure-Requests': 1,
    }
  };

  // if (!isFirstPage) {
  //   options.proxy = "http://127.0.0.1:8080";
  // }

  console.log("loading next page...");
  request.post(options, function (err, httpResponse, body) {
    console.log("Done.");
    callback.call(self, err, httpResponse, body)
  });
}




prot.getFilename = function () {
  var spec = (this.params.spec ? this.params.spec + '' : '0');
  var city = (this.params.city ? this.params.city + '' : '0');
  var postal = (this.params.postal ? this.params.postal + '' : '0');
  return 'data_spec' + spec + '_city' + city + '_postal' + postal + '.xlsx';
}


