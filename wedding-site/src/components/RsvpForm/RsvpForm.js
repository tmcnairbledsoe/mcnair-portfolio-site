import React, {useState} from 'react';
import {readSession, writeSession} from '../../session';
import './RsvpForm.css';
export default function RsvpForm({user}) {
  const key = 'wedding-rsvp:' + user.userName;
  const [response, setResponse] = useState(() => readSession(key, {attendance:'yes',music:'',camera:'no',plusOne:false,guestName:''}));
  const [message, setMessage] = useState('');
  function update(field, value) { setResponse({...response,[field]:value}); setMessage(''); }
  function save(event) {
    event.preventDefault();
    const savedResponse = user.isCouple || !response.plusOne
      ? {...response, plusOne:false, guestName:''} : response;
    setResponse(savedResponse);
    setMessage(writeSession(key, savedResponse) ? 'Your RSVP is saved in this browser tab. You can edit and save it again.' : 'Your browser could not save this RSVP. Your answers remain here until you leave the page.');
  }
  return <section className="register-wrapper section" id="RSVP"><h2>R.S.V.P.</h2><p>Explore the original RSVP form. This keepsake saves your response only in this browser tab.</p>
    <div className="register-block"><form onSubmit={save}>
      <label htmlFor="attendance">Can you make it?</label><select id="attendance" value={response.attendance} onChange={e => update('attendance',e.target.value)}><option value="yes">Yes I will be there</option><option value="no">I can’t make it</option></select>
      <label htmlFor="music">Any song requests?</label><textarea id="music" value={response.music} onChange={e => update('music',e.target.value)} />
      <label htmlFor="camera">Would you like to help shoot video?</label><select id="camera" value={response.camera} onChange={e => update('camera',e.target.value)}><option value="no">No thank you</option><option value="yes">Yes, I would like to help</option></select>
      {!user.isCouple && <><label htmlFor="plus-one">Are you bringing a plus-one?</label><select id="plus-one" value={String(response.plusOne)} onChange={e => update('plusOne',e.target.value === 'true')}><option value="false">No</option><option value="true">Yes</option></select>
        {response.plusOne && <><label htmlFor="guest-name">Guest full name</label><input id="guest-name" value={response.guestName} onChange={e => update('guestName',e.target.value)} /></>}</>}
      <input type="submit" value="Save RSVP" /><p role="status">{message}</p>
    </form></div></section>;
}
