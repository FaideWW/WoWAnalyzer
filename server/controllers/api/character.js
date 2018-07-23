import Express from 'express';
import Sequelize from 'sequelize';
import Raven from 'raven';

import { fetchCharacter as fetchCharacterFromBattleNet } from 'helpers/wowCommunityApi';

import models from '../../models';

const Character = models.Character;

/**
 * Handle requests for character information, and return data from the Blizzard API.
 *
 * This takes 3 formats since at different points of the app we know different types of data:
 *
 * When we are in a Warcraft Logs report that was exported for rankings, we have a character id and the region, realm and name of the character. In that case we call:
 * /140165460/EU/Tarren Mill/Mufre - exported fights
 * This will create a new character with all that data so it can be discovered if we only have partial data. It will then send the battle.net character data.
 *
 * When we are in a Warcraft Logs report that hasn't been exported yet (this primarily happens during prime time where the WCL export queue is slow), we only have a character id. We try to fetch the character info in the hopes that it was stored in the past:
 * /140165460 - unexported fights
 * This will look for the character data by the character id. If it doesn't exist then return 404. If it does exist it will send the battle.net character data.
 *
 * The final option is when the user enters his region, realm and name in the character search box. Then we don't have the character id and call:
 * /EU/Tarren Mill/Mufre - character search
 * This will skip looking for the character and just send the battle.net character data.
 *
 * So the whole purpose of storing the character info is so it's also available on unexported WCL reports where we only have the character id.
 */

function sendJson(res, json) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(json);
}
async function proxyCharacterApi(res, region, realm, name) {
  try {
    const battleNetResponse = await fetchCharacterFromBattleNet(region, realm, name);
    sendJson(res, battleNetResponse);
    return battleNetResponse;
  } catch (error) {
    console.log(error.message);
    Raven.installed && Raven.captureException(error);
    res.status(error.statusCode);
    sendJson(res, error.response.body);
    return null;
  }
}
async function storeCharacter(id, region, realm, name) {
  const character = await Character.findById(id);
  if (!character) {
    await Character.create({
      id,
      region,
      realm,
      name,
    });
  } else {
    await character.update({
      region,
      realm,
      name,
      lastSeenAt: Sequelize.fn('NOW'),
    });
  }
}
const characterIdFromThumbnailRegex = /\/([0-9]+)-/;

const router = Express.Router();
router.get('/:id([0-9]+)', async (req, res) => {
  const character = await Character.findById(req.params.id);
  if (!character) {
    res.sendStatus(404);
    return;
  }
  // noinspection JSIgnoredPromiseFromCall Nothing depends on this, so it's quicker to let it run asynchronous
  character.update({
    lastSeenAt: Sequelize.fn('NOW'),
  });
  await proxyCharacterApi(res, character.region, character.realm, character.name);
});
router.get('/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})', async (req, res) => {
  const { region, realm, name } = req.params;
  // In case you don't look inside proxyCharacterApi: *this sends the data to the browser*.
  const characterInfoString = await proxyCharacterApi(res, region, realm, name);
  // Everything after this happens after the data was sent
  if (!characterInfoString) {
    return;
  }
  const characterInfo = JSON.parse(characterInfoString);
  if (characterInfo && characterInfo.thumbnail) {
    const [,characterId] = characterIdFromThumbnailRegex.exec(characterInfo.thumbnail);
    // noinspection JSIgnoredPromiseFromCall Nothing depends on this, so it's quicker to let it run asynchronous
    storeCharacter(characterId, region, realm, name);
  }
});
router.get('/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})', async (req, res) => {
  const { id, region, realm, name } = req.params;
  // noinspection JSIgnoredPromiseFromCall Nothing depends on this, so it's quicker to let it run asynchronous
  storeCharacter(id, region, realm, name);
  await proxyCharacterApi(res, region, realm, name);
});

export default router;
