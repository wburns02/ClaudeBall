import { describe, it, expect } from 'vitest';
import { VoiceService, OffProvider, DEFAULT_VOICE_PROFILES } from './VoiceService.ts';
import { NotificationService } from './NotificationService.ts';

describe('VoiceService', () => {
  it('starts disabled with Off provider', () => {
    const voice = new VoiceService('off');
    expect(voice.isEnabled()).toBe(false);
    expect(voice.getProviderName()).toBe('Off');
  });

  it('speak is a no-op when disabled', async () => {
    const voice = new VoiceService('off');
    // Should not throw
    await voice.speak('Hello world', 'owner');
  });

  it('has default voice profiles for all roles', () => {
    expect(DEFAULT_VOICE_PROFILES.owner).toBeDefined();
    expect(DEFAULT_VOICE_PROFILES.agent).toBeDefined();
    expect(DEFAULT_VOICE_PROFILES.coach).toBeDefined();
    expect(DEFAULT_VOICE_PROFILES.media).toBeDefined();
    expect(DEFAULT_VOICE_PROFILES.player).toBeDefined();
  });

  it('owner voice is deep and slow', () => {
    expect(DEFAULT_VOICE_PROFILES.owner.pitch).toBeLessThan(1.0);
    expect(DEFAULT_VOICE_PROFILES.owner.rate).toBeLessThan(1.0);
  });

  it('agent voice is high and fast', () => {
    expect(DEFAULT_VOICE_PROFILES.agent.pitch).toBeGreaterThan(1.0);
    expect(DEFAULT_VOICE_PROFILES.agent.rate).toBeGreaterThan(1.0);
  });

  it('can switch providers', () => {
    const voice = new VoiceService('off');
    expect(voice.getProviderName()).toBe('Off');
    // Note: browser_tts won't be available in Node test environment
    voice.setProvider('off');
    expect(voice.getProviderName()).toBe('Off');
  });
});

describe('NotificationService', () => {
  it('sends and retrieves notifications', () => {
    const svc = new NotificationService();
    svc.send({ channel: 'text', fromName: 'Agent Bob', fromRole: 'agent', subject: 'Contract', body: 'We need to talk.', isVoice: false });

    expect(svc.getAll()).toHaveLength(1);
    expect(svc.unreadCount).toBe(1);
  });

  it('marks notifications as read', () => {
    const svc = new NotificationService();
    const notif = svc.send({ channel: 'inbox', fromName: 'Owner', fromRole: 'owner', subject: 'Meeting', body: 'My office. Now.', isVoice: false });

    svc.markRead(notif.id);
    expect(svc.unreadCount).toBe(0);
  });

  it('builds text threads by contact', () => {
    const svc = new NotificationService();
    svc.send({ channel: 'text', fromName: 'Agent Bob', fromRole: 'agent', subject: '', body: 'Hey, you available?', isVoice: false });
    svc.send({ channel: 'text', fromName: 'Agent Bob', fromRole: 'agent', subject: '', body: 'Got an update on the deal.', isVoice: false });
    svc.send({ channel: 'text', fromName: 'Coach Dave', fromRole: 'coach', subject: '', body: 'Great practice today.', isVoice: false });

    const bobThread = svc.getTextThread('Agent Bob');
    expect(bobThread).toHaveLength(2);

    const daveThread = svc.getTextThread('Coach Dave');
    expect(daveThread).toHaveLength(1);

    expect(svc.getTextContacts()).toEqual(['Agent Bob', 'Coach Dave']);
  });

  it('filters by channel', () => {
    const svc = new NotificationService();
    svc.send({ channel: 'text', fromName: 'A', fromRole: 'agent', subject: '', body: 'Text', isVoice: false });
    svc.send({ channel: 'call', fromName: 'B', fromRole: 'owner', subject: '', body: 'Call', isVoice: true });
    svc.send({ channel: 'text', fromName: 'C', fromRole: 'agent', subject: '', body: 'Text2', isVoice: false });

    expect(svc.getByChannel('text')).toHaveLength(2);
    expect(svc.getByChannel('call')).toHaveLength(1);
    expect(svc.getByChannel('press_conference')).toHaveLength(0);
  });

  it('clears all notifications', () => {
    const svc = new NotificationService();
    svc.send({ channel: 'text', fromName: 'A', fromRole: 'agent', subject: '', body: 'Test', isVoice: false });
    svc.clear();
    expect(svc.getAll()).toHaveLength(0);
    expect(svc.getTextContacts()).toHaveLength(0);
  });

  it('serializes and restores', () => {
    const svc = new NotificationService();
    svc.send({ channel: 'text', fromName: 'Agent', fromRole: 'agent', subject: '', body: 'Hey', isVoice: false });
    svc.send({ channel: 'call', fromName: 'Owner', fromRole: 'owner', subject: 'Urgent', body: 'Call me', isVoice: true });

    const saved = svc.serialize();
    const restored = new NotificationService();
    restored.restore(saved);

    expect(restored.getAll()).toHaveLength(2);
    expect(restored.getTextThread('Agent')).toHaveLength(1);
  });
});
