import React from 'react';
import './Navbar.css';
export default function Navbar() {
  return <nav aria-label="Wedding navigation"><ul id="menu"><li><a href="#intro"><span className="description">Charlotte &amp; McNair</span></a></li><li><a href="#location"><span className="description">Locations</span></a></li><li><a href="#RSVP"><span className="description">RSVP</span></a></li><li><a href="#guestInfo"><span className="description">Guest Info</span></a></li><li><a href="#aboutUs"><span className="description">About Us</span></a></li><li><a href="/projects"><span className="description">Portfolio</span></a></li></ul></nav>;
}
