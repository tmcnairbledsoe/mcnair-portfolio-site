import React, {useState} from 'react';
import './App.css';
import Intro from './components/Intro/Intro';
import Location from './components/Location/Location';
import Navbar from './components/Navbar/Navbar';
import AboutUs from './components/AboutUs/AboutUs';
import Login from './components/Login/Login';
import GuestInfo from './components/GuestInfo/GuestInfo';
import RsvpForm from './components/RsvpForm/RsvpForm';
import {readSession, writeSession} from './session';
export default function App() {
  const [user, setUser] = useState(() => readSession('wedding-user', null));
  const [choosingRole, setChoosingRole] = useState(false);
  function signIn(next) {
    setUser(next);
    writeSession('wedding-user', next);
    setChoosingRole(false);
    window.scrollTo(0, 0);
  }
  if (!user || choosingRole) return <Login initialUser={user} onSignIn={signIn} />;
  return <><Navbar /><main><Intro />
    <section className="section guest-controls" aria-label="Your wedding role">
      <h2>Welcome, {user.userName}</h2><p>{user.roleLabel} · April 9, 2022</p>
      <div className="guest-actions"><button onClick={() => setChoosingRole(true)}>Change role</button><button onClick={() => signIn(null)}>Sign out</button></div>
    </section>
    <Location user={user} /><RsvpForm key={user.userName} user={user} /><GuestInfo user={user} /><AboutUs />
  </main></>;
}
