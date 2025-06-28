// Home.jsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import aiImg from "../assets/ai.gif";
import userImg from "../assets/user.gif";
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext);
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const [ham, setHam] = useState(false);
  const isMountedRef = useRef(true);
  const voicesReadyRef = useRef(false);

  const synth = window.speechSynthesis;

  const safeStartRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
        setTimeout(() => {
          if (!isSpeakingRef.current && isMountedRef.current) {
            recognitionRef.current.start();
            console.log("✅ Recognition safely restarted");
          }
        }, 300);
      } catch (e) {
        console.error("Start error:", e);
      }
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    const voices = speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang === 'hi-IN') || voices[0];
    if (hindiVoice) utterance.voice = hindiVoice;

    isSpeakingRef.current = true;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      safeStartRecognition();
    };

    synth.cancel();
    synth.speak(utterance);
  };

  const handleCommand = (data) => {
    const { type, userInput, response } = data;
    setAiText(response);
    speak(response);

    const open = (url) => window.open(url, "_blank");

    if (type === 'google-search') open(`https://www.google.com/search?q=${encodeURIComponent(userInput)}`);
    if (type === 'calculator-open') open(`https://www.google.com/search?q=calculator`);
    if (type === 'instagram-open') open(`https://www.instagram.com/`);
    if (type === 'facebook-open') open(`https://www.facebook.com/`);
    if (type === 'weather-show') open(`https://www.google.com/search?q=weather`);
    if (type === 'youtube-search' || type === 'youtube-play') open(`https://www.youtube.com/results?search_query=${encodeURIComponent(userInput)}`);
  };

  useEffect(() => {
    isMountedRef.current = true;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      if (!isSpeakingRef.current && isMountedRef.current) {
        safeStartRecognition();
      }
    };

    recognition.onerror = (event) => {
      console.warn("Recognition error:", event.error);
      setListening(false);
      if (event.error !== "aborted" && isMountedRef.current && !isSpeakingRef.current) {
        safeStartRecognition();
      }
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      console.log("User said:", transcript);
      const assistantName = userData?.assistantName?.toLowerCase();
      if (assistantName && transcript.toLowerCase().includes(assistantName)) {
        const commandText = transcript.toLowerCase().replace(assistantName, '').trim();
        if (commandText) {
          setUserText(commandText);
          recognition.stop();
          const data = await getGeminiResponse(commandText);
          handleCommand(data);
        }
      } else {
        console.log("Ignored: wake word not found");
        speak(`Please say my name first like '${userData?.assistantName}, open YouTube'. कृपया पहले मेरा नाम बोलें, जैसे '${userData?.assistantName}, ओपन यूट्यूब'.`);
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !isSpeakingRef.current) {
        safeStartRecognition();
      }
    });

    window.addEventListener("click", () => {
      speechSynthesis.getVoices();
      voicesReadyRef.current = true;
    }, { once: true });

    recognition.start();

    return () => {
      isMountedRef.current = false;
      recognition.stop();
    };
  }, []);

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.log(error);
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-t from-black to-[#02023d] flex flex-col items-center justify-center text-white p-4">
      <CgMenuRight className="lg:hidden absolute top-4 right-4 cursor-pointer" onClick={() => setHam(true)} />
      {ham && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/60 p-6 flex flex-col gap-4 z-50">
          <RxCross1 className="absolute top-4 right-4 cursor-pointer" onClick={() => setHam(false)} />
          <button className="bg-white text-black rounded-full px-4 py-2" onClick={handleLogOut}>Log Out</button>
          <button className="bg-white text-black rounded-full px-4 py-2" onClick={() => navigate("/customize")}>Customize Assistant</button>
        </div>
      )}

      <img src={userData?.assistantImage || aiImg} alt="Assistant" className="w-48 h-48 rounded-full object-cover" />
      <h1 className="text-xl font-bold mt-4">I'm {userData?.assistantName}</h1>

      <img src={aiText ? aiImg : userImg} alt="Status" className="w-32 my-4" />

      <h1 className='text-white text-[18px] font-semibold mt-4'>
        You said: <span className='text-blue-400'>{userText || "..."}</span>
      </h1>
      <h1 className='text-white text-[18px] font-semibold'>
        Assistant: <span className='text-green-400'>{aiText || "..."}</span>
      </h1>

      {listening && <p className="text-green-400 mt-4 animate-pulse">🎤 Listening...</p>}
    </div>
  );
}

export default Home;
