/**
 * Lightweight smoke tests — no framework, no mocks. Run with `npm test` (or
 * `node tests/smoke.js`) against a running backend + local MySQL schema.
 *
 * Requires: `node server.js` already running on SMOKE_BASE_URL (default
 * http://localhost:3000), JWT_SECRET set in the environment, and at least one
 * row in Users (id=1 is used as a host/rater fixture). Creates and cleans up
 * its own disposable fixture rows — safe to run against a real dev DB.
 *
 * Covers the highest-value regression classes from the 2026-07-02 audit:
 * DST-correct Israel time parsing, response-shape smoke tests (the class of
 * bug that shipped a permanently-null unread_count), join/leave/waitlist
 * promotion with position renumbering, and ratings-gating.
 */
require('dotenv').config();
const assert = require('assert');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { parseIsraelTime } = require('../utils/israelTime');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const mkToken = (id) => jwt.sign({ id, token_version: 0 }, process.env.JWT_SECRET);

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

async function insertFixtureGame({ hostId = 1, maxPlayers = 4, status = 'active' } = {}) {
  const [result] = await pool.execute(
    `INSERT INTO Games (host_id, sport_type, level, latitude, longitude, location_desc, scheduled_time, max_players, status)
     VALUES (?, 'basketball', 3, 32.08, 34.78, 'Smoke Test Court', '2027-01-01 10:00', ?, ?)`,
    [hostId, maxPlayers, status]
  );
  return result.insertId;
}

async function insertFixtureUsers(count) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const tag = `smoke_${Date.now()}_${i}_${Math.floor(Math.random() * 1e6)}`;
    const [r] = await pool.execute(
      'INSERT INTO Users (username, email, onboarding_complete) VALUES (?, ?, 1)',
      [tag, `${tag}@test.invalid`]
    );
    ids.push(r.insertId);
  }
  return ids;
}

async function main() {
  await test('parseIsraelTime: winter uses UTC+2 (IST)', () => {
    assert.strictEqual(parseIsraelTime('2025-01-15 10:00').toISOString(), '2025-01-15T08:00:00.000Z');
  });

  await test('parseIsraelTime: summer uses UTC+3 (IDT)', () => {
    assert.strictEqual(parseIsraelTime('2025-07-15 10:00').toISOString(), '2025-07-15T07:00:00.000Z');
  });

  await test('parseIsraelTime: empty/null input returns null', () => {
    assert.strictEqual(parseIsraelTime(null), null);
    assert.strictEqual(parseIsraelTime(''), null);
  });

  await test('GET /api/games returns { success: true, games: [] }', async () => {
    const res = await fetch(`${BASE_URL}/api/games`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.games));
  });

  await test('GET /api/notifications returns a real numeric unread_count (not null/NaN)', async () => {
    const token = mkToken(1);
    const res = await fetch(`${BASE_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof data.unread_count, 'number');
    assert.ok(!Number.isNaN(data.unread_count));
  });

  await test('GET /api/users/leaderboard returns an array', async () => {
    const token = mkToken(1);
    const res = await fetch(`${BASE_URL}/api/users/leaderboard`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(data.leaderboard));
  });

  await test('GET /api/courts/mock_sportek_01 returns lat/lng in places', async () => {
    const token = mkToken(1);
    const res = await fetch(`${BASE_URL}/api/courts/mock_sportek_01`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof data.places.lat, 'number');
    assert.strictEqual(typeof data.places.lng, 'number');
  });

  await test('join/leave/waitlist: promotion + renumbering keep positions compact', async () => {
    const gameId = await insertFixtureGame({ maxPlayers: 2 });
    const userIds = await insertFixtureUsers(4);
    try {
      const [uA, uB, uC, uD] = userIds;
      for (const uid of userIds) {
        const res = await fetch(`${BASE_URL}/api/games/${gameId}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${mkToken(uid)}` },
        });
        const data = await res.json();
        assert.strictEqual(data.success, true, `join failed for user ${uid}: ${JSON.stringify(data)}`);
      }

      let [rows] = await pool.execute(
        'SELECT user_id, status, waitlist_position FROM GameParticipants WHERE game_id = ?', [gameId]
      );
      let byUser = Object.fromEntries(rows.map(r => [r.user_id, r]));
      assert.strictEqual(byUser[uA].status, 'joined');
      assert.strictEqual(byUser[uB].waitlist_position, 1);
      assert.strictEqual(byUser[uC].waitlist_position, 2);
      assert.strictEqual(byUser[uD].waitlist_position, 3);

      // Middle waitlisted user leaves — remaining positions must compact, not leave a gap
      await fetch(`${BASE_URL}/api/games/${gameId}/leave`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${mkToken(uB)}` },
      });
      [rows] = await pool.execute(
        'SELECT user_id, status, waitlist_position FROM GameParticipants WHERE game_id = ?', [gameId]
      );
      byUser = Object.fromEntries(rows.map(r => [r.user_id, r]));
      assert.strictEqual(byUser[uC].waitlist_position, 1);
      assert.strictEqual(byUser[uD].waitlist_position, 2);

      // Joined user leaves — first waitlisted is promoted, remainder renumbered
      await fetch(`${BASE_URL}/api/games/${gameId}/leave`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${mkToken(uA)}` },
      });
      [rows] = await pool.execute(
        'SELECT user_id, status, waitlist_position FROM GameParticipants WHERE game_id = ?', [gameId]
      );
      byUser = Object.fromEntries(rows.map(r => [r.user_id, r]));
      assert.strictEqual(byUser[uC].status, 'joined');
      assert.strictEqual(byUser[uD].waitlist_position, 1);
    } finally {
      await pool.execute('DELETE FROM GameParticipants WHERE game_id = ?', [gameId]);
      await pool.execute('DELETE FROM Games WHERE id = ?', [gameId]);
      await pool.execute(`DELETE FROM Users WHERE id IN (${userIds.map(() => '?').join(',')})`, userIds);
    }
  });

  await test('ratings: POST /api/ratings/batch rejects a non-completed game', async () => {
    const gameId = await insertFixtureGame({ status: 'active' });
    try {
      const res = await fetch(`${BASE_URL}/api/ratings/batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mkToken(1)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, ratings: [{ ratee_id: 2, attended: true }] }),
      });
      assert.strictEqual(res.status, 400);
    } finally {
      await pool.execute('DELETE FROM Games WHERE id = ?', [gameId]);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Smoke suite crashed:', err);
  await pool.end();
  process.exit(1);
});
