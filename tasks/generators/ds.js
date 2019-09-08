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

  // let idAr = idStr.split('-');
  // let id = idAr[1];
  // let refNo = idAr[0];

  // https://doctors.cpso.on.ca/DoctorDetails/Benjamin-Barankin/0181819-78418
  var url = `https://doctors.cpso.on.ca/DoctorDetails/some-bullshit/${idStr}`;
  // var url = `http://www.cpso.on.ca/public-register/doctor-details-print.aspx?view=5&id=${id}&ref-no=${refNo}`;
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
  let docTitleTxt = $('#docTitle').text().trim();
  let docTitleTxtAr = docTitleTxt.split(",");
  if (docTitleTxtAr.length == 2) {
    doctor.firstname = docTitleTxtAr[1].trim();
    doctor.lastname = docTitleTxtAr[0].trim();
  }


  // registration class
  let doctorInfoList = $(".doctor-details-heading > div.doctor-info");
  if (doctorInfoList.length) {
    let regClassText = doctorInfoList.eq(doctorInfoList.length - 1).find("div").eq(1).text().trim();
    doctor['Registration Class'] = regClassText.replace(/\r\n/g, "").replace(/\s{1,}/g," ");
  }



  // var sectionSummary = $("section[data-jump-section=Summary]");
  var sectionSummary = $("section#summary");
  var sectionPracticeInfo = $("section#practice_info");
  var sectionSpecialties = $("section#specialties");


  // gender
  doctor.gender = sectionSummary.find("p").eq(1).text().trim().replace(/gender:(\r\n)?/i, "").trim();

  // languages
  doctor.language = sectionSummary.find("p").eq(2).text().trim().replace(/languages spoken:(\r\n)?/i, "").trim();

  // Primary Practice Location
  var phonePattern = /Phone(\sNumber)?\s?:(&#xA0;|&nbsp;)?([\+\(\)\d\-\s]+)/
  var faxPattern = /Fax:(&#xA0;|&nbsp;)?([\+\(\)\d\-\s]+)/
  var cityRowPattern = /(.*)\s+ON\s*([\w][\d][\w]\s*[\d][\w][\d])/


  let primaryAddressAr = [];
  let locationDetailsAr = sectionPracticeInfo.find("div.location_details").html().split("<br>");
  for (let k in locationDetailsAr) {
    let row = locationDetailsAr[k].trim(/\r?\n/).trim().replace(/&#xA0;/g, ' ');

    if (!row.length) {
      continue;
    }

    row = stripTagsGentle(row);

    var matchesP = phonePattern.exec(row);
    var matchesF = faxPattern.exec(row);
    var matchesC = cityRowPattern.exec(row);

    if (matchesP) {
      doctor.phone = matchesP[3].trim();
    } else if (matchesF) {
      doctor.fax = matchesF[2].trim();
    } else {

      if (matchesC) {
        doctor.city = matchesC[1];
        doctor.postal = matchesC[2];
      }

      primaryAddressAr.push(row);
    }
    let sss = "sd";

  }
  doctor.address = primaryAddressAr.join(', ');


  // secondary address
  let addPattern = /Business Address\s?:/
  let secondaryAddressAr = [];
    var divPL1 = sectionPracticeInfo.find("div[class='additional-practice-location collapsible']").find("#professionalcorporationinfo");
  if (divPL1.children().length) {
    let isOn = false;
    let addressesAr = divPL1.html().split("<hr>");
    if (addressesAr.length) {
      let addr = addressesAr[0];
      let addrAr = addr.split("<br>");
      for (let k in addrAr) {
        let row = addrAr[k].trim(/\r?\n/).trim().replace(/&#xA0;/g, ' ');

        if (!isOn) {
          if (addPattern.exec(row)) {
            isOn = true;
            continue;
          }
          continue;
        }

        if (!row.length) {
          continue;
        }

        if (addPattern.exec(row)) {
          // again, not needed;
          break;
        }

        row = stripTagsGentle(row);

        var matchesP = phonePattern.exec(row);
        var matchesF = faxPattern.exec(row);
        var matchesC = cityRowPattern.exec(row);

        if (matchesP) {
          doctor['Secondary Phone'] = matchesP[3];
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
    //$(this).find('td').eq(0).text()
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
  // http://www.cpso.on.ca/DoctorDetails/Adam-Paul/0021198-25986
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
  let reg = /p_lt_ctl01_pageplaceholder_p_lt_ctl03_CPSO_DoctorSearchResults_rptPages_ctl([\d]+)_lnbPage/;

  let isNextChunkAvailable = ($('.doctor-search-paging a[class=next]').length > 0);
  nextChunkLink = 'p$lt$ctl01$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$lnbNextGroup';
  let curPage = $('#p_lt_ctl01_pageplaceholder_p_lt_ctl03_CPSO_DoctorSearchResults_hdnCurrentPage').val();

  let nextParams = null;

  //DEBUG
  //return nextParams;


  if (isNextChunkAvailable) {
    nextParams = {
      __EVENTTARGET: nextChunkLink,
      "p$lt$ctl01$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$hdnCurrentPage": curPage
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
  // let nextLink = `p$lt$ctl01$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$rptPages$ctl${curPage.padStart(2, '0')}$lnbPage`;
  let nextLink = `p$lt$ctl01$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$rptPages$ctl${num}$lnbPage`;


  //p$lt$ctl01$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$hdnCurrentPage
  //p$lt$ctl01$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$rptPages$ctl00$lnbPage
  return {
    __EVENTTARGET: nextLink,
    "p$lt$ctl01$pageplaceholder$p$lt$ctl03$CPSO_DoctorSearchResults$hdnCurrentPage": curPage
  };
}

prot.loadForm = function (callback) {
  //var url = "http://www.cpso.on.ca/Public-Register/All-Doctors-Search";
  // var url = "http://www.cpso.on.ca/Public-Information-Services/Find-a-Doctor";
  var url = "https://doctors.cpso.on.ca?search=general";
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

  let cityVar = "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$ddCity";
  let typeVar = "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$grpDocType";
  let specVar = "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$ddSpecialist";
  let postalVar = "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$txtPostalCode";

  var payload = {

    //"__EVENTTARGET": "p$lt$ctl04$pageplaceholder$p$lt$ctl04$CPSO_DoctorSearchResults$lnkNext",
    //'Referer': 'http://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results'
  };

  // var url = "https://www.cpso.on.ca/Public-Register-Info-(1)/Doctor-Search-Results";

  var url = "https://doctors.cpso.on.ca/RootNewSite/New-Find-a-Doctor/Doctor-Search-Results?type=name&term=";

  if (isFirstPage && params) {
    url = "https://doctors.cpso.on.ca?search=general";

    payload = _.extend(payload, {
      "__EVENTTARGET": "",
      "__LASTFOCUS":"",
      "searchType": "general",

      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$advancedState":"closed",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$ConcernsState":"closed",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$txtLastNameQuick":"",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$txtCPSONumber":"",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$txtLastName":"",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$grpGender":" ",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$ddHospitalName":	"-1",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$ddLanguage":	"08",

      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$chkActiveDoctors":"on",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$chkPracticeRestrictions":"on",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$chkPendingHearings":"on",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$chkPastHearings":"on",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$chkHospitalNotices":	"on",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$chkConcerns":"on",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$chkNotices":"on",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$txtExtraInfo":"",
      "p$lt$ctl01$pageplaceholder$p$lt$ctl02$CPSO_AllDoctorsSearch$btnSubmit1":"Submit",

      //__EVENTTARGET: "p$lt$ctl04$pageplaceholder$p$lt$ctl03$AllDoctorsSearch$btnSubmit",
      //Referer: 'http://www.cpso.on.ca/Public-Register/All-Doctors-Search'
      //Referer: 'http://www.cpso.on.ca/Public-Information-Services/Find-a-Doctor'
    })

    payload[cityVar] = "";
    payload[typeVar] = params.spec == "001" ? "rdoDocTypeAll" : "rdoDocTypeSpecialist";

    if (params.spec) {
      payload[specVar] = params.spec;
    }

    payload[cityVar] = "";
    payload[postalVar] = "";

    if (params.city) {
      payload[cityVar] = params.city;
    } else if (params.postal) {
      payload[postalVar] = params.postal;
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
    "__VIEWSTATE": viewstate
  });

  var options = {
    url: `${url}`,
    form: payload,
    //proxy:"http://127.0.0.1:8080",
    followAllRedirects: true,
    headers: {
      'Host': 'doctors.cpso.on.ca',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:68.0) Gecko/20100101 Firefox/68.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      // 'Accept-Encoding': 'gzip, deflate',
      'Referer': 'https://doctors.cpso.on.ca/?search=general',
      'Content-Type': 'application/x-www-form-urlencoded',
      "Cookie": self.cookies,
      'Connection': 'close',
      'Upgrade-Insecure-Requests': 1,
    }
  };

  if (!isFirstPage) {
    options.proxy = "http://127.0.0.1:8080";
  }

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


