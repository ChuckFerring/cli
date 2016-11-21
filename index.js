#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander');
var colors = require('colors');
var OnboardingCli = require("./onboardingCli");
var TranslatorCli = require("./translatorCli");
var fs = require('fs');
var helpers = require('./helpers');
var translatorCli = new TranslatorCli();

// set theme 
colors.setTheme({
  silly: 'rainbow',
  header: 'cyan'
});

program
    .version('1.0.0')
    .option('-o --onboarding [Translator Package Name]', 'Do onboarding for specified thing')
    .option('-h --hub [Hub Package Name]', 'Gets devices for the given hub')
    .option('-r --refreshAuthToken [Translator Package Name]', 'Refresh the oauth token for the given hub')
    
    .option('-t --translator [Translator Package Name]', 'Do get property for specified thing, requires -p')
    .option('-i --id [Control id]', 'Control id you want to use')
    .option('-d --di [Device id]', 'Device id of the resource you want to control')
    .option('-g --get [RAML property name]', 'Property name to GET for -t')
    .option('-s --set [RAML property name]', 'Property name to SET for -t')
    .option('-v --value [value]', 'Stringified JSON value to pass in')
    .parse(process.argv);

console.log('Open Translators to Things CLI:');
console.log('');

if (program.onboarding) {
    console.log("------ Doing onboarding for %j".header, program.onboarding);
    
    var fileName = helpers.createOnboardingFileName(program.onboarding);

    var onboardingCli = new OnboardingCli();
    onboardingCli.doOnboarding(program.onboarding).then(info => {
        var data = JSON.stringify(info);
        helpers.logObject(info);
        console.log("------ Saving onboardingInfo to: " + fileName); 
        fs.writeFile(fileName, data, function (err) {
            if (err) {
                console.log(err);
                return console.log(err);
            }
            console.log("Saved!");
        });
    }).catch(err => {
        helpers.logError(err);
    });
}

// this is for devices which communicate via a hub translator (hub device or central cloud)
else if (program.translator && program.hub) {
    console.log("------ Hub + translator for %j %j".header, program.hub, program.translator);

    if (program.id === undefined) {
        console.log("Need to provide id, -i <id>");
        return;
    }

    var fileName = helpers.createOnboardingFileName(program.hub);
    helpers.readFile(fileName, "Please complete onboarding -o").then(data => { 
        var deviceInfo = JSON.parse(data);
        translatorCli.createTranslator(program.hub, deviceInfo).then(hub => {
            var fileName = helpers.createHubDeviceFileName(program.translator, program.id);
            //var fileName = "./" + program.translator + "_device_" + program.id + ".json";
            console.log(fileName);
            helpers.readFile(fileName, "Please complete hub -h before calling -t").then(data => {
                var deviceInfo = JSON.parse(data);
                var dInfo = { 'deviceInfo': deviceInfo, 'hub': hub };
                
                if (program.get) {
                    translatorCli.getProperty(program.translator, dInfo, program.get, true).then(info => {
                        helpers.logObject(info);
                    }).catch(error => {
                        helpers.logError(error);
                    });
                }
                else if (program.set) {
                    var parsedValue = undefined;
                    try {
                        parsedValue = JSON.parse(program.value);
                    } catch (e) {
                        helpers.logError("Failed to parse JSON: " + program.value);
                        return;
                    }

                    translatorCli.setProperty(program.translator, dInfo, program.set, program.di, parsedValue).then(info => {
                        helpers.logObject(info)
                    }).catch(error => {
                        helpers.logError(error);
                    });
                }
            });
        });
    }).catch(error => {
        helpers.logError(error);
    });
}

else if (program.hub) {
    console.log("------ Hub enumerate devices for %j".header, program.hub);

    var fileName = helpers.createOnboardingFileName(program.hub);
    helpers.readFile(fileName, "Please complete onboarding -o").then(data => { 
        var deviceInfo = JSON.parse(data);
        translatorCli.getProperty(program.hub, deviceInfo, 'getPlatforms').then(info => {
            helpers.logObject(info);
            helpers.writeArrayToFile(info.platforms, "_device_", "controlId");
        }).catch(error => {
            helpers.logError(error);
        });
    }).catch(error => {
        helpers.logError(error);
    });
}
else if(program.refreshAuthToken){
    console.log("------ Refreshing oAuth token for hub %j".header, program.refreshAuthToken);
    var onboardingCli = new OnboardingCli();
    onboardingCli.loadTranslatorAndGetOnboardingAnswers(program.refreshAuthToken).then(answers => {
        var fileName = helpers.createOnboardingFileName(program.refreshAuthToken);
        helpers.readFile(fileName, "Please complete onboarding -o").then(data => { 
        var authInfo = JSON.parse(data);
        translatorCli.getProperty(program.refreshAuthToken, authInfo, 'refreshAuthToken', answers).then(refreshedInfo => {
            helpers.logObject(refreshedInfo);
            //helpers.writeArrayToFile(info.platforms, "_device_", "controlId");
        }).catch(error => {
            helpers.logError(error);
        });
    }).catch(error => {
        helpers.logError(error);
    });
    });
   
}

// this is for top level devices which don't require a hub
else if (program.translator) {
    console.log("------ Doing translator for %j".header, program.translator);

    var fileName = helpers.createHubDeviceFileName(program.translator, program.id);
    //var fileName = "./" + program.translator + "_device_" + program.id + ".json";
    helpers.readFile(fileName, "Please complete onboarding -o").then(data => { 
        var deviceInfo = JSON.parse(data);
        var dInfo = { 'deviceInfo': deviceInfo, 'hub': undefined };

        translatorCli.getProperty(program.translator, deviceInfo, program.get).then(info => {
            helpers.logObject(info);
        }).catch(error => {
            helpers.logError(error);
        });
    }).catch(error => {
        helpers.logError(error);
    });
}

else {
    program.outputHelp(make_red);
}

function make_red(txt) {
    //display the help text in red on the console
    return colors.red(txt);
}