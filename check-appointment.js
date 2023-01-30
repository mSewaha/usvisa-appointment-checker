#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import CLI from 'clui';
import puppeteer from 'puppeteer';
import fs from 'fs';
import beepbeep from 'beepbeep';
import * as path from 'path';
import {fileURLToPath} from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(`${__dirname}/.config.json`));

let locationId = '';
let country = '';

switch(config.location) {
  case 'vancouver':
    locationId = '95';
    country = 'ca'
    break;
  case 'calgary':
    locationId = '89';
    country = 'ca'
    break;
  case 'ottawa':
    locationId = '92';
    country = 'ca'
    break;
  case 'toronto':
    locationId = '94';
    country = 'ca'
  case 'montreal':
    locationId = '91';
  case 'london':
    locationId = '17';
    country = 'gb'
}

const sendEmail = async (subject, body) => {
  let transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.from_email,
      pass: config.from_password
    }
  });

  await transport.sendMail({
    from: `"US VISA Appointment Alerter" ${config.from_email}`,
    to: config.to_email,
    subject: subject,
    text: body,
  });
}

clear();

console.log(
  chalk.yellow(
    figlet.textSync('VISA Appointment')
  )
);

const interval = 600000;

const alertBefore = new Date(config.alert_for_appointment_before);

let gSpinner = new CLI.Spinner('Waiting for the next run...');

let checkAvailability = () => {
  (async () => {
    gSpinner.stop();
    console.log(chalk.gray('Opening Chrome headless...'));
    let browser = await puppeteer.launch();
    let page = await browser.newPage();

    let spinner = new CLI.Spinner('Signing in...');
    spinner.start();

    const us_gb_signin_url = `https://ais.usvisa-info.com/en-${country}/niv/users/sign_in`

    await page.goto(us_gb_signin_url);
    await page.type('#user_email', config.username);
    await page.type('#user_password', config.password);
    await page.$eval('#policy_confirmed', check => check.checked = true);
    await page.waitForTimeout(3000);
    await Promise.all([
      page.waitForNavigation(), page.click('input[type=submit]')
    ]).catch(() => { console.error("Error Occurred.") });
    spinner.stop();
    console.log(chalk.green('Signed in!'));

    var date = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium', hour12: true });
    console.log(chalk.yellow(`Checking at: ${date}`));

    let response = await page.goto(`https://ais.usvisa-info.com/en-${country}/niv/schedule/${config.schedule_id}/appointment/days/${locationId}.json?appointments[expedite]=false`);

    var availabilityJson = await response.json();
    availabilityJson = availabilityJson.slice(0, 5).map(value => value.date)

    let availability = JSON.stringify(availabilityJson, null, 2)
    
    console.log(availabilityJson);

    if (availabilityJson.length == 0) {
      console.log(chalk.red('No appointments!'));
      await sendEmail("LOG", `No appointments at all! \n\n${availability}\n--\n\nChecked at ${date}`)
    } else if(Date.parse(availabilityJson[0]) < alertBefore){
      console.log(chalk.green('Early appointment available!!!'));
      console.log(chalk.white(availabilityJson[0].date));
      await sendEmail("🎊 - Early appointment available!", `${us_gb_signin_url} \n\n${availability}\n--\n\nChecked at ${date}`)
      beepbeep(5)
    } else {
      console.log(chalk.red('No early appointments!'));
      await sendEmail("LOG", `No early appointments! \n\n${availability}\n--\n\nChecked at ${date}`)
    }
    console.log(chalk.gray('Closing Chrome headless...'));
    await browser.close();

    let next = new Date();
    next.setTime(next.getTime() + interval);
    console.log(chalk.gray(`Next checking at: ${next.toLocaleString('en-GB', { timeZone: 'UTC' })}`));
    gSpinner.start();
    setTimeout(checkAvailability, interval);
  })();
}

checkAvailability();
