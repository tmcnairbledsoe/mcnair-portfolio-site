import React from 'react';
import './App.css';
import Intro from './components/Intro/Intro';
import Location from './components/Location/Location';
import Navbar from './components/Navbar/Navbar';
import AboutUs from './components/AboutUs/AboutUs';
export default function App() {
  return <><Navbar /><main><Intro /><section className="section" id="RSVP"><h2>A wedding keepsake</h2><p>We celebrated our wedding on April 9, 2022. This is an archive of our original wedding website. RSVPs and guest sign-in are closed.</p><p><a href="/projects">Back to McNair's projects</a></p></section><Location user={{isRehearsal:false}} /><AboutUs /></main></>;
}
