import {
  GESTION_NOTE_TEMPLATES,
  REJECTION_REASON_MAX_LENGTH,
  REJECTION_REPLY_TEMPLATES,
} from './requests.constants';

describe('reply templates (EP3-82)', () => {
  it('tiene plantillas de rechazo con texto editable y bajo el máximo', () => {
    expect(REJECTION_REPLY_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of REJECTION_REPLY_TEMPLATES) {
      expect(template.label.trim()).not.toBe('');
      expect(template.text.trim()).not.toBe('');
      expect(template.text.length).toBeLessThanOrEqual(REJECTION_REASON_MAX_LENGTH);
    }
  });

  it('tiene plantillas de nota de gestión con texto no vacío', () => {
    expect(GESTION_NOTE_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of GESTION_NOTE_TEMPLATES) {
      expect(template.label.trim()).not.toBe('');
      expect(template.text.trim()).not.toBe('');
      expect(template.text.length).toBeLessThanOrEqual(500);
    }
  });
});
