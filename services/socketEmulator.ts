
import { AnswerResponse } from '../types';
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type EventCallback = (data: any) => void;

class SocketEmulator {
  private localChannel: BroadcastChannel;
  private supabaseChannel: RealtimeChannel | null = null;
  private currentRoom: string | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public isConnected: boolean = false;

  constructor() {
    this.localChannel = new BroadcastChannel('eduslide_sync_channel');
    this.localChannel.onmessage = (event) => {
      const { type, data } = event.data;
      // Local broadcast loopback
      this.trigger(type, data);
    };
  }

  public joinRoom(roomCode: string) {
    if (this.currentRoom === roomCode && this.supabaseChannel) {
      console.log(`[Socket] Already in room ${roomCode}`);
      return;
    }

    this.leaveRoom();
    this.currentRoom = roomCode;
    console.log(`[Socket] Joining room: ${roomCode}`);

    // Initialize Supabase Realtime for THIS room
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      this.supabaseChannel = supabase.channel(`room_${roomCode}`, {
        config: {
          broadcast: { self: false },
          presence: {
            key: roomCode,
          },
        },
      });

      this.supabaseChannel
        .on('broadcast', { event: 'sync' }, (payload) => {
          const { type, data } = payload.payload;
          console.log(`[Socket] RX Broadcast: ${type}`, data);
          this.trigger(type, data);
        })
        .on('presence', { event: 'sync' }, () => {
          const newState = this.supabaseChannel?.presenceState();
          this.trigger('presence:sync', newState);
        })
        .subscribe((status) => {
          console.log(`[Socket] Subscription status: ${status}`);
          this.isConnected = status === 'SUBSCRIBED';
        });
    } else {
      console.warn("[Socket] Supabase URL missing. Falling back to Local BroadcastChannel only (Dev Mode).");
      this.isConnected = true;
    }
  }

  public trackPresence(userData: any) {
    if (this.supabaseChannel) {
      this.supabaseChannel.track(userData).catch(err => console.error("[Socket] Presence Error:", err));
    }
  }

  public leaveRoom() {
    if (this.supabaseChannel) {
      console.log(`[Socket] Leaving room ${this.currentRoom}`);
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
    this.currentRoom = null;
    this.isConnected = false;
  }

  public on(type: string, callback: EventCallback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(callback);
  }

  public off(type: string, callback: EventCallback) {
    this.listeners.get(type)?.delete(callback);
  }

  public emit(type: string, data: any) {
    // Debug log
    if (!type.startsWith('draw:')) { // Reduce noise for drawing
      console.log(`[Socket] Emit: ${type}`, data);
    }

    // 1. Local trigger (Logic handling for self)
    this.trigger(type, data);

    // 2. BroadcastChannel trigger (same origin, different tab)
    this.localChannel.postMessage({ type, data });

    // 3. Supabase trigger (cross device)
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'sync',
        payload: { type, data }
      }).catch(err => console.error(`[Socket] Send Error (${type}):`, err));
    } else {
      if (!this.currentRoom) console.warn("[Socket] Emit called but not in a room!");
    }
  }

  private trigger(type: string, data: any) {
    this.listeners.get(type)?.forEach((cb) => cb(data));
  }
}

export const socket = new SocketEmulator();

