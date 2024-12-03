class PeerService {
  constructor() {
    if (!this.peer) {
      this.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
      });

      // Add transceivers explicitly to control SDP order
      this.peer.addTransceiver("audio", { direction: "sendrecv" });
      this.peer.addTransceiver("video", { direction: "sendrecv" });
    }
  }

  async getAnswer(offer) {
    if (this.peer) {
      await this.peer.setRemoteDescription(offer); // Set the incoming offer
      const ans = await this.peer.createAnswer(); // Generate the answer
      await this.peer.setLocalDescription(ans); // Set the local description
      return ans;
    }
  }

  async setLocalDescription(ans) {
    if (this.peer) {
      await this.peer.setRemoteDescription(new RTCSessionDescription(ans)); // Set remote SDP
    }
  }

  async getOffer() {
    if (this.peer) {
      const offer = await this.peer.createOffer(); // Create an offer
      await this.peer.setLocalDescription(offer); // Set the local description
      return offer;
    }
  }
}

export default new PeerService();