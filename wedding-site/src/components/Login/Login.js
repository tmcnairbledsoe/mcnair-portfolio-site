import React, {useState} from 'react';
import './Login.css';
const roles = {
  guest: {label:'Wedding guest', isWeddingParty:false, isRehearsal:false, isBrunch:false},
  party: {label:'Wedding party', isWeddingParty:true, isRehearsal:true, isBrunch:true},
  rehearsal: {label:'Rehearsal guest', isWeddingParty:false, isRehearsal:true, isBrunch:false},
  brunch: {label:'Brunch guest', isWeddingParty:false, isRehearsal:false, isBrunch:true},
};
export default function Login({initialUser, onSignIn}) {
  const [userName, setUserName] = useState(initialUser?.userName || '');
  const [step, setStep] = useState(initialUser ? 'role' : 'name');
  const [role, setRole] = useState(initialUser?.role || 'guest');
  const [isCouple, setIsCouple] = useState(initialUser?.isCouple || false);
  const [isRehearsal, setIsRehearsal] = useState(initialUser?.isRehearsal || false);
  const [isBrunch, setIsBrunch] = useState(initialUser?.isBrunch || false);
  const [error, setError] = useState('');
  function chooseRole(value) {
    setRole(value);
    setIsRehearsal(roles[value].isRehearsal);
    setIsBrunch(roles[value].isBrunch);
  }
  function submit(event) {
    event.preventDefault();
    if (!userName.trim()) { setError('Please enter a username.'); return; }
    setError('');
    if (step === 'name') { setStep('role'); return; }
    onSignIn({userName:userName.trim(), role, roleLabel:roles[role].label,
      isWeddingParty:roles[role].isWeddingParty, isRehearsal, isBrunch, isCouple});
  }
  return <div className="loginContainer"><form className="login-form" onSubmit={submit}>
    <h1>Charlotte &amp; McNair</h1><h2>{step === 'name' ? 'Welcome' : 'Choose your role'}</h2>
    {step === 'name' ? <><p>Enter any username to explore our wedding website. No password is needed.</p>
      <div id="inputFields"><label htmlFor="wedding-name">Username</label><input id="wedding-name" autoComplete="off" maxLength={80} value={userName} onChange={e => setUserName(e.target.value)} /></div></> : <>
      <p>Welcome, {userName}. Choose which guest layout you would like to see.</p>
      <label htmlFor="wedding-role">Your role</label><select id="wedding-role" value={role} onChange={e => chooseRole(e.target.value)}>
        {Object.entries(roles).map(([value, settings]) => <option key={value} value={value}>{settings.label}</option>)}
      </select>
      <fieldset><legend>Your invitations</legend>
        <label><input type="checkbox" checked={isRehearsal} onChange={e => setIsRehearsal(e.target.checked)} /> Rehearsal dinner</label>
        <label><input type="checkbox" checked={isBrunch} onChange={e => setIsBrunch(e.target.checked)} /> Sunday brunch</label>
        <label><input type="checkbox" checked={isCouple} onChange={e => setIsCouple(e.target.checked)} /> We are attending as a couple</label>
      </fieldset></>}
    {error && <p role="alert">{error}</p>}
    <button type="submit">{step === 'name' ? 'Log in →' : 'View wedding website →'}</button>
    {step === 'role' && <button type="button" onClick={() => setStep('name')}>Change username</button>}
    <p>A keepsake of our April 2022 wedding. Your choices and RSVP stay in this browser tab.</p>
    <a href="/projects">Back to McNair’s projects</a>
  </form></div>;
}
