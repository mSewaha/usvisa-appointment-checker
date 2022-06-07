#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import CLI from 'clui';
import puppeteer from 'puppeteer';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./.config'));

clear();

console.log(
  chalk.yellow(
    figlet.textSync('VISA Appointment')
  )
);

let datePoint = new Date('2022-12-08');

(async () => {
  console.log(chalk.gray('Opening Chrome headless...'));
  let browser = await puppeteer.launch();
  let page = await browser.newPage();

  let spinner = new CLI.Spinner('Signing in...');
  spinner.start();

  await page.goto('https://ais.usvisa-info.com/en-ca/niv/users/sign_in');
  await page.type('#user_email', config.username);
  await page.type('#user_password', config.password);
  await page.$eval('#policy_confirmed', check => check.checked = true);
  await page.waitForTimeout(3000);
  await Promise.all([
    page.waitForNavigation(), page.click('input[type=submit]')
  ]).catch(() => { console.error("Error Occured.") });
  spinner.stop()
  console.log(chalk.green('Signed in!'));

  let response = await page.goto('https://ais.usvisa-info.com/en-ca/niv/schedule/34703553/appointment/days/95.json?appointments[expedite]=false');
  let json = await response.json();
  console.log(json.slice(0, 5))
  let firstDate = Date.parse(json[0].date);
  
  if(firstDate < datePoint){
    console.log(chalk.green('Early appointment avaliable!!!'));
    console.log(chalk.white(json[0].date));
  } else {
    console.log(chalk.red('No early appointments!'));
  }
  await browser.close();
})();

