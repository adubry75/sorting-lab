/* Sorting Lab audio, AGPL-3.0. MIDI mapping adapted from CompilerStuck's
   MidiSys.java. The soft, sine-led voice is synthesized with Web Audio;
   no Java, MIDI device, soundfont download, or third-party runtime is required. */
function SortingAudio({createContext,onError=()=>{}}={}) {
  let context=null,master=null,wave=null,voice=null,enabled=true,volume=.35;
  function silence(){
    if(!voice||!context)return;
    const old=voice;voice=null;
    // Fade rather than interrupting a waveform mid-cycle.
    const now=context.currentTime;
    // A separate gate leaves the note's envelope automation intact. It also
    // avoids cancelAndHoldAtTime, which is unavailable in some browsers.
    old.gate.gain.setValueAtTime(1,now);
    old.gate.gain.linearRampToValueAtTime(0,now+.008);
    old.osc.stop(now+.012);
  }
  function unlock(){
    if(!enabled)return Promise.resolve();
    try {
      if(!context){
        const make=createContext||(()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)());
        context=make();master=context.createGain();master.gain.value=volume;master.connect(context.destination);
        // Mostly a sine, with a faint octave and third harmonic for warmth.
        // No dense upper spectrum, random phase, or sharp per-frame restarts.
        const real=new Float32Array(4),imag=new Float32Array([0,1,.09,.018]);
        wave=context.createPeriodicWave(real,imag);
      }
      return context.resume().catch(onError);
    }catch(error){onError(error);return Promise.resolve();}
  }
  function play(value,length,{step=false}={}){
    if(!enabled||volume===0||!context||context.state!=='running'||!Number.isInteger(value)||value<0||value>=length)return;
    const now=context.currentTime,note=SortingAudio.noteFor(value,length),frequency=440*Math.pow(2,(note-69)/12);
    if(voice&&now>=voice.endsAt){silence();}
    if(!voice){
      const osc=context.createOscillator(),gain=context.createGain(),gate=context.createGain();
      osc.setPeriodicWave(wave);osc.frequency.value=frequency;gain.gain.value=0;
      osc.connect(gain);gain.connect(gate);gate.connect(master);
      const current={osc,gain,gate,note,endsAt:now};voice=current;
      osc.onended=()=>{osc.disconnect();gain.disconnect();gate.disconnect();if(voice===current)voice=null;};
      osc.start(now);
    }else if(voice.note!==note){
      // Keep oscillator phase continuous while approaching the same mapped pitch.
      voice.osc.frequency.setTargetAtTime(frequency,now,.018);voice.note=note;
    }
    const level=.12,hold=step?.045:.08,release=step?.025:.05;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(level,now,.014);
    voice.gain.gain.setTargetAtTime(0,now+hold,release);
    voice.endsAt=now+(step?.23:.55);
    // Replacing the scheduled stop extends this one voice while writes continue.
    voice.osc.stop(voice.endsAt);
  }
  function setEnabled(value){enabled=!!value;if(!enabled)silence();}
  function setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(master)master.gain.setTargetAtTime(volume,context.currentTime,.01);if(!volume)silence();}
  function dispose(){silence();if(context)context.close().catch(()=>{});}
  return {unlock,play,silence,setEnabled,setVolume,dispose,get enabled(){return enabled;},get volume(){return volume;}};
}
SortingAudio.noteFor=(value,length)=>length>0?Math.max(0,Math.min(127,28+Math.floor(40*(value+1)/length))):28;
if(typeof module!=='undefined')module.exports={SortingAudio,noteFor:SortingAudio.noteFor};
