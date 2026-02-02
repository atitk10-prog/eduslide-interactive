
import { AnswerResponse } from '../types';
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type EventCallback = (data: any) => void;

class SocketEmulator {
  private localChannel: BroadcastChannel;
  private supabaseChannel: RealtimeChannel | null = null;
  private currentRoom: string | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    this.localChannel = new BroadcastChannel('eduslide_sync_channel');
    this.localChannel.onmessage = (event) => {
      const { type, data } = event.data;
      this.trigger(type, data);
    };
  }

  public joinRoom(roomCode: string) {
    if (this.currentRoom === roomCode) return;

    this.leaveRoom();
    this.currentRoom = roomCode;

    // Initialize Supabase Realtime for THIS room
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      this.supabaseChannel = supabase.channel(`room_${roomCode}`, {
        config: {
          presence: {
            key: roomCode,
          },
        },
      })
        .on('broadcast', { event: 'sync' }, (payload) => {
          const { type, data } = payload.payload;
          this.trigger(type, data);
        })
        .on('presence', { event: 'sync' }, () => {
          const newState = this.supabaseChannel?.presenceState();
          this.trigger('presence:sync', newState);
        })
        .subscribe();
    }
  }

  public trackPresence(userData: any) {
    if (this.supabaseChannel) {
      this.supabaseChannel.track(userData);
    }
  }

  public leaveRoom() {
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
    this.currentRoom = null;
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
    // 1. Local trigger
    this.trigger(type, data);

    // 2. BroadcastChannel trigger (same origin, same device)
    this.localChannel.postMessage({ type, data });

    // 3. Supabase trigger (cross device)
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'sync',
        payload: { type, data }
      });
    }
  }

  private trigger(type: string, data: any) {
    this.listeners.get(type)?.forEach((cb) => cb(data));
  }
}

export const socket = new SocketEmulator();

