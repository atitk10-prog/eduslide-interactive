
import { AnswerResponse } from '../types';
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type EventCallback = (data: any) => void;

class SocketEmulator {
  private channel: BroadcastChannel;
  private supabaseChannel: RealtimeChannel | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    this.channel = new BroadcastChannel('eduslide_sync_channel');
    this.channel.onmessage = (event) => {
      const { type, data } = event.data;
      this.trigger(type, data);
    };

    // Initialize Supabase Realtime if credentials exist
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
      this.supabaseChannel = supabase.channel('eduslide_room_sync')
        .on('broadcast', { event: 'sync' }, (payload) => {
          const { type, data } = payload.payload;
          this.trigger(type, data);
        })
        .subscribe();
    }
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
    this.channel.postMessage({ type, data });

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

