'use client';

import { useTransition } from 'react';
import { saveProfileAction } from '@/app/actions/account';
import { toast } from '@/components/ui/ToastHost';

type Profile = {
  name: string;
  email: string;
  phone: string;
  newsletter: boolean;
  street: string;
  zip: string;
  city: string;
} | null;

/**
 * Zapis idzie w dwa miejsca: dane kontaktowe do `profiles`, adres dostawy
 * do `addresses`. E-mail należy do sesji Supabase — jego zmiana to osobna
 * operacja z potwierdzeniem mailem, więc pole jest tylko do odczytu.
 */
export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [saving, startSave] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startSave(async () => {
      const result = await saveProfileAction(formData);
      toast(result.ok ? 'Dane zapisane' : `Nie udało się zapisać: ${result.error}`);
    });
  }

  return (
    <div className="card-box">
      <h3>Dane konta</h3>
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="set-name">Imię i nazwisko</label>
            <input
              id="set-name"
              name="name"
              type="text"
              autoComplete="name"
              defaultValue={profile?.name ?? ''}
            />
          </div>
          <div className="field">
            <label htmlFor="set-phone">Telefon</label>
            <input
              id="set-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+48 600 000 000"
              defaultValue={profile?.phone ?? ''}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="set-email">E-mail</label>
          <input
            id="set-email"
            type="email"
            value={profile?.email || email}
            readOnly
            title="Adres logowania zmienia się w ustawieniach konta Supabase."
          />
        </div>

        <h3 style={{ margin: '28px 0 14px' }}>Adres dostawy</h3>
        <div className="field">
          <label htmlFor="set-street">Ulica i numer</label>
          <input
            id="set-street"
            name="street"
            type="text"
            autoComplete="street-address"
            placeholder="Krucza 12/4"
            defaultValue={profile?.street ?? ''}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="set-zip">Kod pocztowy</label>
            <input
              id="set-zip"
              name="zip"
              type="text"
              autoComplete="postal-code"
              placeholder="00-001"
              defaultValue={profile?.zip ?? ''}
            />
          </div>
          <div className="field">
            <label htmlFor="set-city">Miasto</label>
            <input
              id="set-city"
              name="city"
              type="text"
              autoComplete="address-level2"
              placeholder="Warszawa"
              defaultValue={profile?.city ?? ''}
            />
          </div>
        </div>

        <label className="check" style={{ marginTop: 18 }}>
          <input type="checkbox" name="newsletter" defaultChecked={profile?.newsletter} /> Newsletter
          z promocjami
        </label>

        <button className="btn" type="submit" style={{ marginTop: 22 }} disabled={saving}>
          {saving ? 'Zapisuję…' : 'Zapisz dane'}
        </button>
      </form>
    </div>
  );
}
