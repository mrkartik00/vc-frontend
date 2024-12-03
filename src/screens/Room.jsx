import React, { useEffect, useCallback, useState } from "react";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoRef, setVideoRef] = useState(null);

  // Predefine transceivers for consistent SDP order
  useEffect(() => {
    if (peer.peer) {
      peer.peer.addTransceiver("audio", { direction: "sendrecv" });
      peer.peer.addTransceiver("video", { direction: "sendrecv" });
    }
  }, []);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    stream.getTracks().forEach((track) => {
      const sender = peer.peer.getSenders().find((s) => s.track?.kind === track.kind);
      if (sender) {
        sender.replaceTrack(track); // Replace track for existing sender
      }
    });

    setMyStream(stream);

    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      stream.getTracks().forEach((track) => {
        const sender = peer.peer.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track); // Replace track for existing sender
        }
      });

      setMyStream(stream);

      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      console.log(`Call accepted by ${from}`);
      peer.setLocalDescription(ans);
    },
    []
  );

  const handleTrackEvent = useCallback((event) => {
    const [stream] = event.streams;
    console.log("Received remote stream");
    setRemoteStream(stream);

    // Attach the remote stream to the video element
    if (videoRef) {
      videoRef.srcObject = stream;
    }
  }, [videoRef]);

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    peer.peer.addEventListener("track", handleTrackEvent);

    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
      peer.peer.removeEventListener("track", handleTrackEvent);
    };
  }, [handleNegoNeeded, handleTrackEvent]);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
    };
  }, [socket, handleUserJoined, handleIncommingCall, handleCallAccepted]);

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
      {remoteSocketId && <button onClick={handleCallUser}>Call User</button>}
      {myStream && (
        <div>
          <h2>My Stream</h2>
          <video
            autoPlay
            muted
            style={{ width: "300px", height: "200px", background: "black" }}
            ref={(ref) => ref && (ref.srcObject = myStream)}
          />
        </div>
      )}
      {remoteStream && (
        <div>
          <h2>Remote Stream</h2>
          <video
            autoPlay
            style={{ width: "300px", height: "200px", background: "black" }}
            ref={(ref) => setVideoRef(ref)}
          />
        </div>
      )}
    </div>
  );
};

export default RoomPage;