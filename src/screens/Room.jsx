import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    if (!remoteSocketId) {
      console.error("No remote user to call");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);

      const offer = await peer.getOffer();
      await peer.peer.setLocalDescription(offer);
      socket.emit("user:call", { to: remoteSocketId, offer });
    } catch (error) {
      console.error("Error in handleCallUser:", error);
    }
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      try {
        if (peer.peer.signalingState !== "stable") {
          console.error(
            "Cannot handle incoming call. Invalid signaling state:",
            peer.peer.signalingState
          );
          return;
        }

        setRemoteSocketId(from);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);

        console.log(`Incoming Call from ${from}`);
        await peer.peer.setRemoteDescription(new RTCSessionDescription(offer));
        const ans = await peer.getAnswer(offer);
        await peer.peer.setLocalDescription(ans);
        socket.emit("call:accepted", { to: from, ans });
      } catch (error) {
        console.error("Error in handleIncommingCall:", error);
      }
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (myStream) {
      const senders = peer.peer.getSenders();
      for (const track of myStream.getTracks()) {
        if (!senders.some((sender) => sender.track === track)) {
          peer.peer.addTrack(track, myStream);
        }
      }
    } else {
      console.error("Stream not initialized");
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      try {
        if (peer.peer.signalingState === "have-local-offer") {
          await peer.peer.setRemoteDescription(new RTCSessionDescription(ans));
          console.log("Call accepted by", from);
          sendStreams();
        } else {
          console.error(
            "Cannot handle call accepted. Invalid signaling state:",
            peer.peer.signalingState
          );
        }
      } catch (error) {
        console.error("Error in handleCallAccepted:", error);
      }
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    try {
      const offer = await peer.getOffer();
      socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
    } catch (error) {
      console.error("Error in handleNegoNeeded:", error);
    }
  }, [remoteSocketId, socket]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      try {
        const ans = await peer.getAnswer(offer);
        socket.emit("peer:nego:done", { to: from, ans });
      } catch (error) {
        console.error("Error in handleNegoNeedIncomming:", error);
      }
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    try {
      await peer.peer.setRemoteDescription(new RTCSessionDescription(ans));
    } catch (error) {
      console.error("Error in handleNegoNeedFinal:", error);
    }
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    peer.peer.addEventListener("track", (event) => {
      const remoteStream = event.streams[0];
      setRemoteStream(remoteStream);
    });

    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Connected to a peer" : "Waiting for a peer..."}</h4>
      {remoteSocketId && <button onClick={handleCallUser}>Call</button>}
      {myStream && (
        <>
          <h2>My Stream</h2>
          <ReactPlayer playing muted height="200px" width="300px" url={myStream} />
        </>
      )}
      {remoteStream && (
        <>
          <h2>Remote Stream</h2>
          <ReactPlayer playing height="200px" width="300px" url={remoteStream} />
        </>
      )}
    </div>
  );
};

export default RoomPage;