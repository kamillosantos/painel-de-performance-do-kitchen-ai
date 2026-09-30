import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build, eligibility, evaluateCatalog, isOfficialEmbed, relatedVideos, renderSitemap, renderVideoPage } from '../scripts/build.mjs';

const site = { siteName: 'Kitchen AI Global', baseUrl: 'https://kamillosantos.github.io/painel-de-performance-do-kitchen-ai/' };
// These are isolated test fixtures only; they are never stored in or published from data/videos.json.
function testRecord(overrides = {}) {
  return {
    video_id: 'TEST_ONLY_001', slug: 'fixture-dish-test-only-001', title: 'Fixture dish — TEST ONLY',
    description: 'Synthetic test description, never a catalog item.',
    thumbnail: 'https://images.example.test/test-only.jpg', source: 'Test fixture',
    source_url: 'https://example.test/source', content_type: 'TEST_ONLY', language: 'en', country: 'Testland',
    rights_status: 'OWNED', attribution: 'Synthetic test fixture — not for publication',
    provenance: { evidence_url: 'https://example.test/evidence', evidence_note: 'Test-only evidence fixture.' },
    editorial_summary: 'Synthetic test summary with sufficient length. This is a fixture and not a real or published video.',
    status: 'PUBLISHED', publication_date: '2026-01-02', native_media_url: 'https://media.example.test/test-only.mp4',
    entities: ['test entity'], ingredients: ['test ingredient'], techniques: ['test technique'],
    dish: 'test dish', chef: 'test chef', restaurant: null, city: null, season: 'test season',
    ...overrides
  };
}

test('empty catalog creates no video records or video pages', () => {
  const result = evaluateCatalog([]);
  assert.equal(result.eligible.length, 0);
  assert.equal(result.excluded.length, 0);
  const sitemap = renderSitemap([], site);
  assert.equal((sitemap.match(/<url>/g) || []).length, 1);
  assert.match(sitemap, /kamillosantos\.github\.io\/painel-de-performance-do-kitchen-ai\//);
});

test('unknown rights and missing evidence prevent eligibility', () => {
  const result = eligibility(testRecord({ rights_status: 'UNKNOWN', provenance: null }));
  assert.equal(result.eligible, false);
  assert.ok(result.issues.includes('direitos não verificados'));
  assert.ok(result.issues.includes('evidência de proveniência ausente ou inválida'));
});

test('a verified, complete record is eligible', () => {
  assert.equal(eligibility(testRecord()).eligible, true);
});

test('official embeds must use supported HTTPS embed hosts', () => {
  assert.equal(isOfficialEmbed('https://www.youtube.com/embed/abc123'), true);
  assert.equal(isOfficialEmbed('https://player.vimeo.com/video/12345'), true);
  assert.equal(isOfficialEmbed('https://attacker.example/embed/abc'), false);
  assert.equal(isOfficialEmbed('javascript:alert(1)'), false);
});

test('public page escapes metadata and emits VideoObject only with verifiable playback and date', () => {
  const video = testRecord({ title: '<script>alert("x")</script>', native_media_url: 'https://media.example.test/test-only.mp4' });
  const entry = { video, slug: video.slug };
  const html = renderVideoPage(video, video.slug, [entry], site);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(/);
  assert.match(html, /"@type":"VideoObject"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  const noVideoObject = renderVideoPage(testRecord({ native_media_url: null, publication_date: null }), 'fallback-test-only', [], site);
  assert.doesNotMatch(noVideoObject, /"@type":"VideoObject"/);
  assert.match(noVideoObject, /Descoberta editorial/);
});

test('unapproved external players are never embedded', () => {
  const video = testRecord({ rights_status: 'LICENSED', native_media_url: null, embed_url: 'https://evil.example/player?id=1', publication_date: null });
  const html = renderVideoPage(video, video.slug, [{ video, slug: video.slug }], site);
  assert.doesNotMatch(html, /evil\.example/);
  assert.match(html, /reprodução externa não é contornada/);
});

test('recommendations are based on shared content entities and never recommend the same record', () => {
  const a = testRecord({ video_id: 'A', ingredients: ['tomato'], slug: 'a-test' });
  const b = testRecord({ video_id: 'B', ingredients: ['tomato'], slug: 'b-test', title: 'B test' });
  const c = testRecord({ video_id: 'C', ingredients: ['cinnamon'], entities: [], techniques: [], dish: 'other dish', chef: 'other chef', country: 'Otherland', season: 'other season', slug: 'c-test', title: 'C test' });
  const result = relatedVideos(a, [{ video: a, slug: 'a-test' }, { video: b, slug: 'b-test' }, { video: c, slug: 'c-test' }]);
  assert.deepEqual(result.map((entry) => entry.video.video_id), ['B']);
});

test('duplicate IDs/slugs fail the build rather than replacing pages', () => {
  assert.throws(() => evaluateCatalog([testRecord({ video_id: 'FIRST' }), testRecord({ video_id: 'SECOND', title: 'Second' })]), /duplicate public slug/);
  assert.throws(() => evaluateCatalog([testRecord(), testRecord({ video_id: 'TEST_ONLY_001', slug: 'another' })]), /duplicate video_id/);
});

test('write/check round trip produces only the homepage sitemap entry for the actual empty manifest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kitchen-ai-test-'));
  try {
    await fs.mkdir(path.join(root, 'data'), { recursive: true });
    await fs.mkdir(path.join(root, 'content'), { recursive: true });
    await fs.writeFile(path.join(root, 'data/videos.json'), '[]\n');
    await fs.writeFile(path.join(root, 'content/site.json'), JSON.stringify(site));
    const result = await build({ root, write: true });
    assert.deepEqual({ eligible: result.eligible, excluded: result.excluded }, { eligible: 0, excluded: 0 });
    await assert.rejects(fs.access(path.join(root, 'video')));
    assert.equal((await fs.readFile(path.join(root, 'sitemap.xml'), 'utf8')).match(/<url>/g).length, 1);
    await build({ root, write: false });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
