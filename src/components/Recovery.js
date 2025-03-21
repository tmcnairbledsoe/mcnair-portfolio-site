import React, { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { CosmosClient } from "@azure/cosmos";

const Recovery = () => {
    const { accounts } = useMsal();
    const account = accounts[0];

    const [userData, setUserData] = useState([]);
    const [formData, setFormData] = useState({
        lastUse: "",
        substancesUsed: [],
        symptoms: [],
        suicidalIdeation: "",
        homicidalIdeation: "",
        mood: "",
        affect: "",
        thoughtProcess: "",
        attention: 5,
        insight: 5,
        judgment: 5,
        appetite: 5,
        sleep: 5,
        adls: 5,
        relationships: 5,
        exercise: 5,
        nutrition: 5,
        recoveryWork: 5,
        triggersToday: 5,
        cravings: 5,
        coping: 5,
        selfCare: 5,
        abilityToProcure: 5,
        phasesOfRelapse: [],
        journalEntry: ""
    });

    const [advice, setAdvice] = useState([]);
    const [viewingHistory, setViewingHistory] = useState(false);

    const cosmosClient = new CosmosClient({
        endpoint: process.env.REACT_APP_COSMOS_DB_ENDPOINT,
        key: process.env.REACT_APP_COSMOS_DB_KEY
    });
    const container = cosmosClient.database("RecoveryData").container("UserEntries");

    const fetchUserData = useCallback(async () => {
        try {
            const { resources } = await container.items.query({
                query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.date DESC",
                parameters: [{ name: "@userId", value: account.username }]
            }).fetchAll();

            setUserData(resources || []);
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUserData([]);
        }
    }, [account]);


    useEffect(() => {
        if (account) fetchUserData();
    }, [account, fetchUserData]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === "checkbox") {
            setFormData((prev) => ({
                ...prev,
                [name]: checked
                    ? [...prev[name], value]
                    : prev[name].filter((item) => item !== value)
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async () => {
        const dateToday = new Date().toISOString().split("T")[0];

        const newEntry = {
            userId: account.username,
            date: dateToday,
            formData,
            wellnessScore: calculateWellnessScore(),
            relapseRisk: calculateRelapseRisk()
        };

        try {
            await container.items.upsert(newEntry);
            setUserData([newEntry, ...userData]);
            alert("Your recovery entry has been saved.");
        } catch (error) {
            console.error("Error saving entry:", error);
        }
    };

    const calculateWellnessScore = () => {
        let score = 100;
        const lastUseDate = new Date(formData.lastUse);
        const daysSinceLastUse = (new Date() - lastUseDate) / (1000 * 60 * 60 * 24);
        score += daysSinceLastUse > 365 ? 5 : daysSinceLastUse > 30 ? 2 : -10;

        if (
            formData.substancesUsed.includes("Opioids") ||
            formData.substancesUsed.includes("Alcohol")
        ) {
            score -= 15;
        } else if (formData.substancesUsed.length > 0) {
            score -= 10;
        }

        const lowFields = [
            "attention", "insight", "judgment", "appetite", "sleep", "exercise",
            "nutrition", "recoveryWork", "coping", "selfCare"
        ];

        score -= lowFields.filter((k) => formData[k] < 4).length * 5;
        if (formData.phasesOfRelapse.length > 3) score -= 10;

        return Math.max(0, Math.min(100, score));
    };

    const calculateRelapseRisk = () => {
        let risk = 0;
        if (formData.triggersToday > 7) risk += 10;
        if (formData.cravings > 7) risk += 15;
        if (formData.coping < 4) risk += 20;
        if (formData.selfCare < 4) risk += 10;
        if (formData.phasesOfRelapse.length > 5) risk += 25;
        return Math.min(100, risk);
    };

    const generateAdvice = useCallback(() => {
        const messages = [];
        if (formData.exercise < 5) messages.push("Exercise is low. Consider moving more.");
        if (formData.nutrition < 5) messages.push("Eat nutritious meals to help stabilize your recovery.");
        if (formData.recoveryWork < 5) messages.push("Engage more with your recovery routine.");
        if (formData.triggersToday > 7) messages.push("Today was high in triggers. Stay alert.");
        if (calculateRelapseRisk() > 50) messages.push("Your relapse risk is high. Reach out if needed.");
        setAdvice(messages);
    }, [formData]); // formData is a dependency

    useEffect(() => {
        generateAdvice();
    }, [generateAdvice]);

    return (
        <div className="recovery-container" style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Daily Recovery Tracker</h2>

            <div className="form-group">
                <label>Last Date of Use:</label>
                <input type="date" name="lastUse" value={formData.lastUse} onChange={handleInputChange} />
            </div>

            <div className="form-group">
                <label>Substance(s) Used:</label>
                <div className="checkbox-group">
                    {["Alcohol", "Opioids", "Dissociates", "Psychedelics", "Sedatives", "Stimulants"].map((sub) => (
                        <label key={sub} className="checkbox-item">
                            <input type="checkbox" name="substancesUsed" value={sub} checked={formData.substancesUsed.includes(sub)} onChange={handleInputChange} />
                            {sub}
                        </label>
                    ))}
                </div>
            </div>

            <div className="form-group">
                <label>Symptoms:</label>
                <div className="checkbox-group">
                    {[
                        "None", "Anger", "Fatigue", "Sweat/chills", "Shakes", "Anxiety", "Isolating",
                        "Irritability", "Headaches", "Depression", "Nightmares", "Diarrhea", "Constipation",
                        "Chronic pain", "Urge to restrict food", "Urge to purge", "Lack of energy",
                        "Racing thoughts", "Trouble concentrating", "Extremely sensitive skin",
                        "Emotional outbursts", "Mood swings", "Trouble with hygiene", "Muscle cramps/soreness",
                        "Balance issues", "Nausea/Vomiting", "Lack of motivation"
                    ].map((symptom) => (
                        <label key={symptom} className="checkbox-item">
                            <input type="checkbox" name="symptoms" value={symptom} checked={formData.symptoms.includes(symptom)} onChange={handleInputChange} />
                            {symptom}
                        </label>
                    ))}
                </div>
            </div>

            <div className="form-group">
                <label>Suicidal Ideation:</label>
                <select name="suicidalIdeation" value={formData.suicidalIdeation} onChange={handleInputChange}>
                    {["Stable", "Passive", "Active", "Active Plan", "Means", "Intent", "Contract for Safety"].map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label>Homicidal Ideation:</label>
                <select name="homicidalIdeation" value={formData.homicidalIdeation} onChange={handleInputChange}>
                    {["Stable", "Passive", "Active", "Active Plan", "Means", "Intent"].map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label>Mood:</label>
                <select name="mood" value={formData.mood} onChange={handleInputChange}>
                    {["Stable", "Depressed", "Anxious", "Irritable", "Euthymic", "Angry"].map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label>Affect:</label>
                <select name="affect" value={formData.affect} onChange={handleInputChange}>
                    {["Labile", "Inappropriate", "Appropriate", "Flat", "Elevated", "Blunt"].map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label>Thought Process:</label>
                <select name="thoughtProcess" value={formData.thoughtProcess} onChange={handleInputChange}>
                    {["Logical", "Obsessive", "Tangential", "Circumstantial", "Loose", "Disorganized"].map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            {[
                "attention", "insight", "judgment", "appetite", "sleep",
                "adls", "relationships", "exercise", "nutrition", "recoveryWork",
                "triggersToday", "cravings", "coping", "selfCare", "abilityToProcure"
            ].map((metric) => (
                <div className="form-group" key={metric}>
                    <label>{metric.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())} (1–10):</label>
                    <input
                        type="number"
                        min="1"
                        max="10"
                        name={metric}
                        value={formData[metric]}
                        onChange={handleInputChange}
                    />
                </div>
            ))}

            <h3 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Phases of Relapse</h3>
            <div className="form-group">
                <label>Phase 1: Internal Change</label>
                {["Increased Stress", "Change in Thinking", "Change in Feeling", "Change in Behavior"].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 2: Denial</label>
                {["Worrying about Myself", "Denying that I am worried"].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 3: Avoidance and Defensiveness</label>
                {[
                    "Believing I will never use alcohol or drugs", "Worrying about others instead of self",
                    "Defensiveness", "Compulsive behavior", "Impulsive Behavior", "Tendencies toward loneliness"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 4: Crisis Building</label>
                {["Tunnel Vision", "Minor Depression", "Loss of Constructive Planning", "Plans Begin to Fail"].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 5: Immobilization</label>
                {[
                    "Daydreaming and Wishful Thinking", "Feelings that Nothing can be solved", "Immature wish to be happy"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 6: Confusion and Overreaction</label>
                {[
                    "Difficulty thinking clearly", "Difficulty in managing feelings and emotions",
                    "Difficulty in remembering things", "Periods in confusion", "Difficulty in managing stress",
                    "Irritation with friends", "Easily angered"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 7: Depression</label>
                {[
                    "Irregular Eating Habits", "Lack of Desire to Take Action", "Difficulty sleeping restfully",
                    "Loss of daily structure", "Periods of deep depression"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 8: Behavioral Loss of Control</label>
                {[
                    "Irregular treatment meetings", "An I don't care attitude", "Open rejection of help",
                    "Dissatisfaction of life", "Feelings of powerlessness and helplessness"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 9: Recognition of Loss of Control</label>
                {[
                    "Difficulty with physical coordination and accidents", "Self-pity", "Thoughts of social use",
                    "Conscious lying", "Complete loss of self-confidence"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 10: Option Reduction</label>
                {[
                    "Unreasonable Resentment", "Discontinues all treatment",
                    "Overwhelming Loneliness Frustration Anger and Tension", "Loss of Behavioral Control"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group">
                <label>Phase 11: Alcohol and Drug Use</label>
                {[
                    "Attempting Controlled Use", "Disappointment Shame and Guilt",
                    "Loss of Control", "Life and Health Problems"
                ].map((item) => (
                    <label key={item} className="checkbox-item">
                        <input type="checkbox" name="phasesOfRelapse" value={item} checked={formData.phasesOfRelapse.includes(item)} onChange={handleInputChange} />
                        {item}
                    </label>
                ))}
            </div>

            <div className="form-group" style={{ marginTop: "2rem", padding: "1rem", background: "#f9f9f9", borderRadius: "6px" }}>
                <label><strong>Journal Entry</strong></label>
                <textarea
                    name="journalEntry"
                    value={formData.journalEntry}
                    onChange={handleInputChange}
                    rows="6"
                    placeholder="Write your thoughts here..."
                    style={{ width: "100%", padding: "10px", fontSize: "1rem" }}
                />
            </div>

            <div className="form-group">
                <button onClick={handleSubmit} style={{ padding: "10px 20px", fontSize: "1rem", marginTop: "1rem" }}>
                    Submit
                </button>
            </div>

            <hr style={{ margin: "2rem 0" }} />

            <h2 style={{ marginBottom: "1rem" }}>Recovery Dashboard</h2>
            <button onClick={() => setViewingHistory(!viewingHistory)} style={{ marginBottom: "1.5rem" }}>
                {viewingHistory ? "Back to Questionnaire" : "View Past Entries"}
            </button>
            {viewingHistory ? (
                <div className="history-entries">
                    <h3>Past Recovery Entries</h3>
                    {Array.isArray(userData) && userData.length > 0 ? (
                        userData.map((entry) => (
                            <div key={entry.date} className="history-entry" style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: "6px", marginBottom: "1rem" }}>
                                <strong>Date:</strong> {entry.date}
                                <p><strong>Wellness Score:</strong> {entry.wellnessScore}</p>
                                <p><strong>Relapse Risk:</strong> {entry.relapseRisk}%</p>
                                <p><strong>Journal:</strong> {entry.formData.journalEntry}</p>
                            </div>
                        ))
                    ) : (
                        <p>No past entries found.</p>
                    )}
                </div>
            ) : (
                <div>
                    <h3>Your Wellness Score: {calculateWellnessScore()}</h3>
                    <h3>Your Relapse Risk: {calculateRelapseRisk()}%</h3>

                    <div className="advice-section" style={{ marginTop: "1.5rem" }}>
                        <h4>Advice:</h4>
                        <ul style={{ paddingLeft: "1.25rem" }}>
                            {(advice && advice.length > 0)
                                ? advice.map((tip, index) => <li key={index}>{tip}</li>)
                                : <li>No advice today. Keep up the good work!</li>
                            }
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recovery;
