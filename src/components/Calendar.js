import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { TableClient, AzureSASCredential } from "@azure/data-tables";
import "./Calendar.css";

const Calendar = () => {
  const { accounts } = useMsal();
  const account = accounts[0];
  const userRoles = account?.idTokenClaims.roles || [];
  const isOwner = userRoles.includes("OwnerRole");
  const isWife = userRoles.includes("WifeRole");
  const canViewData = isOwner || isWife;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ time: "", text: "", members: "McNair" });
  const [monthEvents, setMonthEvents] = useState({});

  const accountName = process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME;
  const sasToken = process.env.REACT_APP_AZURE_STORAGE_SAS_TOKEN;
  const tableClient = useMemo(() => {
    return new TableClient(
      `https://${accountName}.table.core.windows.net`,
      "CalendarEvents",
      new AzureSASCredential(sasToken)
    );
  }, [accountName, sasToken]);

  const checkAndCreateTable = useCallback(async () => {
    try {
      await tableClient.listEntities().next(); // Try to get table properties (this will throw if the table doesn't exist)
    } catch (error) {
      if (error.statusCode === 404) {
        try {
          await tableClient.createTable();
          console.log("Table created successfully.");
        } catch (creationError) {
          console.error("Error creating table: ", creationError);
        }
      } else {
        console.error("Error checking table existence: ", error);
      }
    }
  }, [tableClient]);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const loadMonthEvents = useCallback(async (date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();

    try {
      const entities = tableClient.listEntities({
        queryOptions: {
          filter: `PartitionKey ge '${startOfMonth}' and PartitionKey le '${endOfMonth}'`,
        },
      });

      const eventsByDay = {};
      for await (const entity of entities) {
        const eventDate = new Date(entity.Date + "T00:00:00Z").getUTCDate(); // Ensure we get the correct day
        if (!eventsByDay[eventDate]) eventsByDay[eventDate] = [];
        eventsByDay[eventDate].push(entity);
      }
      setMonthEvents(eventsByDay);

      setEvents(eventsByDay[date.getDate()] || []);
    } catch (error) {
      console.error("Error loading month events: ", error);
    }
  }, [tableClient]);

  useEffect(() => {
    const initializeCalendar = async () => {
      if (canViewData) {
        await checkAndCreateTable();
        await loadMonthEvents(new Date());
      }
    };

    initializeCalendar();
  }, [checkAndCreateTable, loadMonthEvents, canViewData]);

  const handleDayClick = (day) => {
    const clickedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    setSelectedDate(clickedDate);
    setEvents(monthEvents[day] || []);
  };

  const changeMonth = async (offset) => {
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1);
    setSelectedDate(newDate);
    await loadMonthEvents(newDate);
  };

  const handleAddEvent = () => setShowForm(true);

  const handleCancel = () => {
    setShowForm(false);
    setNewEvent({ time: "", text: "", members: "McNair" });
  };

  const handleSubmit = async () => {
    const newEntity = {
      PartitionKey: selectedDate.toISOString(),
      RowKey: new Date().toISOString(),
      Date: formatDate(selectedDate),
      Members: newEvent.members,
      Time: newEvent.time,
      Text: newEvent.text,
    };

    try {
      await tableClient.createEntity(newEntity);
      const updatedEvents = [...(monthEvents[selectedDate.getDate()] || []), newEntity];
      setMonthEvents({ ...monthEvents, [selectedDate.getDate()]: updatedEvents });
      setEvents(updatedEvents);
      setShowForm(false);
      setNewEvent({ time: "", text: "", members: "McNair" });
    } catch (error) {
      console.error("Error creating event: ", error);
    }
  };

  const renderCalendarDays = () => {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
    const today = new Date();

    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      const isPast = currentDate < today && formatDate(currentDate) !== formatDate(today);
      const hasEvent = monthEvents[day] && monthEvents[day].length > 0;
      const dayClass = hasEvent
        ? isPast
          ? "calendar-day past-event"
          : "calendar-day future-event"
        : "calendar-day";

      calendarDays.push(
        <div key={day} className={dayClass} onClick={() => handleDayClick(day)}>
          <span className="day-number">{day}</span>
          <div className="events-mini">
            {monthEvents[day] && monthEvents[day].map((event, idx) => (
              <div key={idx} className="event-mini">
                {event.Members ? (event.Members === "Both" ? "M&C" : event.Members.charAt(0)) : ""}: {event.Time}: {event.Text}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return calendarDays;
  };

  if (!canViewData) {
    return <p>You do not have access to view this calendar.</p>;
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={() => changeMonth(-1)}>{"<"}</button>
        <h2>{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <button onClick={() => changeMonth(1)}>{">"}</button>
      </div>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}
        {renderCalendarDays()}
      </div>
      <div className="events-container">
        <h3>Events on {selectedDate.toDateString()}</h3>
        {events.length > 0 ? (
          events.map((event, index) => (
            <div key={index} className="event">
              {event.Time} - {event.Text} ({event.Members})
            </div>
          ))
        ) : (
          <p>No events for this day.</p>
        )}
      </div>
        <div>
          {!showForm && <button onClick={handleAddEvent}>Add Event</button>}
          {showForm && (
            <div>
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
              />
              <input
                type="text"
                value={newEvent.text}
                onChange={(e) => setNewEvent({ ...newEvent, text: e.target.value })}
                placeholder="Event details"
              />
              <select
                value={newEvent.members}
                onChange={(e) => setNewEvent({ ...newEvent, members: e.target.value })}
              >
                <option value="McNair">McNair</option>
                <option value="Charlotte">Charlotte</option>
                <option value="Both">Both</option>
              </select>
              <button onClick={handleSubmit}>Submit</button>
              <button onClick={handleCancel}>Cancel</button>
            </div>
          )}
        </div>
    </div>
  );
};

export default Calendar;
