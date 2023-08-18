import { describe, expect, test, jest } from '@jest/globals';
import * as solace from 'solclientjs';
import { SolacePubSub } from '../solace-pubsub';

let messageConsumerEventListenerMap = new Map<any, any>();

class MockSolaceMessage extends solace.Message {
  private destination: solace.Destination;
  private corelationKey: string | object | null | undefined;

  constructor() {
    super();
  }

  public acknowledge(): void {
    //do nothing
  }

  public getDestination(): solace.Destination | null {
    return this.destination;
  }

  public setDestination(value: solace.Destination): void {
    this.destination = value;
  }

  public setCorrelationKey(value: string | object | null | undefined): void {
    this.corelationKey = value;
  }

  public getBinaryAttachment(): string | Uint8Array | null {
    return '{}';
  }
}

let mockMessageConsumer: solace.MessageConsumer = {
  on: function <U extends keyof solace.MessageConsumerEventNameEvents>(event: U, listener: solace.MessageConsumerEventNameEvents[U]): solace.MessageConsumer {
    messageConsumerEventListenerMap.set(event, listener);
    return this;
  },
  disposed: false,
  session: undefined,
  start: function (): void {},
  stop: function (): void {},
  connect: function (): void {},
  disconnect: function (): void {},
  getDestination: function (): solace.Destination {
    throw new Error('Function not implemented.');
  },
  getProperties: function (): solace.MessageConsumerProperties {
    throw new Error('Function not implemented.');
  },
  addSubscription: function (topic: solace.Destination, correlationKey: string | object | null | undefined, requestTimeout: number): void {
    let mockSessionEvent = { correlationKey: correlationKey };

    if (messageConsumerEventListenerMap.get(solace.MessageConsumerEventName.SUBSCRIPTION_OK)) messageConsumerEventListenerMap.get(solace.MessageConsumerEventName.SUBSCRIPTION_OK)(mockSessionEvent);
  },
  removeSubscription: function (topic: solace.Destination, correlationKey: string | object | null | undefined, requestTimeout: number): void {
    let mockSessionEvent = { correlationKey: correlationKey };
    if (messageConsumerEventListenerMap.get(solace.MessageConsumerEventName.SUBSCRIPTION_OK)) messageConsumerEventListenerMap.get(solace.MessageConsumerEventName.SUBSCRIPTION_OK)(mockSessionEvent);
  },
  clearStats: function (): void {},
  dispose: function (): void {},
  getStat: function (statType: solace.StatType): number {
    return 0;
  },
  addListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.MessageConsumer {
    messageConsumerEventListenerMap.set(eventName, listener);
    return this;
  },
  once: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.MessageConsumer {
    return this;
  },
  removeListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.MessageConsumer {
    messageConsumerEventListenerMap.delete(eventName);
    return this;
  },
  off: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.MessageConsumer {
    return this;
  },
  removeAllListeners: function (event?: string | symbol | undefined): solace.MessageConsumer {
    return this;
  },
  setMaxListeners: function (n: number): solace.MessageConsumer {
    return this;
  },
  getMaxListeners: function (): number {
    return 0;
  },
  listeners: function (eventName: string | symbol): Function[] {
    return [];
  },
  rawListeners: function (eventName: string | symbol): Function[] {
    return [];
  },
  emit: function (eventName: string | symbol, ...args: any[]): boolean {
    if (messageConsumerEventListenerMap.get(eventName)) messageConsumerEventListenerMap.get(eventName)(args[0]);
    return true;
  },
  listenerCount: function (eventName: string | symbol, listener?: Function | undefined): number {
    return 0;
  },
  prependListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.MessageConsumer {
    return this;
  },
  prependOnceListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.MessageConsumer {
    return this;
  },
  eventNames: function (): (string | symbol)[] {
    return [];
  },
};

let mockSolaceSession: solace.Session = {
  on(event: solace.SessionEventCode, listener: (param?: any) => void): solace.Session {
    return this;
  },

  connect: function (): void {},
  disconnect: function (): void {},
  dispose: function (): void {},
  subscribe: function (topic: solace.Destination, requestConfirmation: boolean, correlationKey: string | object | null | undefined, requestTimeout: number | null | undefined): void {},
  unsubscribe: function (topic: solace.Destination, requestConfirmation: boolean, correlationKey: string | object | null | undefined, requestTimeout: number | null | undefined): void {},
  unsubscribeDurableTopicEndpoint: function (queueDescriptor: solace.AbstractQueueDescriptor | solace.QueueDescriptor): void {},
  updateProperty: function (mutableSessionProperty: solace.MutableSessionProperty, newValue: object, requestTimeout: number, correlationKey: string | object | null | undefined): void {},
  updateAuthenticationOnReconnect: function (authenticationProperties: object): void {},
  send: function (message: solace.Message): void {},
  sendRequest: function (
    message: solace.Message,
    timeout?: number | undefined,
    replyReceivedCBFunction?: ((session: solace.Session, message: solace.Message, userObject: object) => void) | undefined,
    requestFailedCBFunction?: ((session: solace.Session, error: solace.RequestError, userObject: object) => void) | undefined,
    userObject?: object | undefined
  ): void {
    throw new Error('Function not implemented.');
  },
  sendReply: function (messageToReplyTo: solace.Message, replyMessage: solace.Message): void {
    throw new Error('Function not implemented.');
  },
  getStat: function (statType: solace.StatType): number {
    throw new Error('Function not implemented.');
  },
  resetStats: function (): void {
    throw new Error('Function not implemented.');
  },
  getSessionProperties: function (): solace.SessionProperties {
    throw new Error('Function not implemented.');
  },
  isCapable: function (capabilityType: solace.CapabilityType): boolean {
    throw new Error('Function not implemented.');
  },
  getCapability: function (capabilityType: solace.CapabilityType): solace.SDTField {
    throw new Error('Function not implemented.');
  },
  createCacheSession: function (properties: solace.CacheSessionProperties): solace.CacheSession {
    throw new Error('Function not implemented.');
  },
  createMessageConsumer: function (consumerProperties: object | solace.MessageConsumerProperties): solace.MessageConsumer {
    return mockMessageConsumer;
  },
  createQueueBrowser: function (browserProperties: object | solace.QueueBrowserProperties): solace.QueueBrowser {
    throw new Error('Function not implemented.');
  },
  getTransportInfo: function (): string {
    throw new Error('Function not implemented.');
  },
  addListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.Session {
    throw new Error('Function not implemented.');
  },
  once: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.Session {
    throw new Error('Function not implemented.');
  },
  removeListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.Session {
    throw new Error('Function not implemented.');
  },
  off: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.Session {
    throw new Error('Function not implemented.');
  },
  removeAllListeners: function (event?: string | symbol | undefined): solace.Session {
    throw new Error('Function not implemented.');
  },
  setMaxListeners: function (n: number): solace.Session {
    throw new Error('Function not implemented.');
  },
  getMaxListeners: function (): number {
    throw new Error('Function not implemented.');
  },
  listeners: function (eventName: string | symbol): Function[] {
    throw new Error('Function not implemented.');
  },
  rawListeners: function (eventName: string | symbol): Function[] {
    throw new Error('Function not implemented.');
  },
  emit: function (eventName: string | symbol, ...args: any[]): boolean {
    throw new Error('Function not implemented.');
  },
  listenerCount: function (eventName: string | symbol, listener?: Function | undefined): number {
    throw new Error('Function not implemented.');
  },
  prependListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.Session {
    throw new Error('Function not implemented.');
  },
  prependOnceListener: function (eventName: string | symbol, listener: (...args: any[]) => void): solace.Session {
    throw new Error('Function not implemented.');
  },
  eventNames: function (): (string | symbol)[] {
    throw new Error('Function not implemented.');
  },
};

describe('PubSubUnit Connect Tests', () => {
  test('It should not attempt to create a session but should create a message consumer and connect to a queue', async () => {
    const createMessageConsumerSpy = jest.spyOn(mockSolaceSession, 'createMessageConsumer');
    const messageConsumerConnectSpy = jest.spyOn(mockMessageConsumer, 'connect');
    const sessionConnectSpy = jest.spyOn(mockSolaceSession, 'connect');

    let pubSub = await SolacePubSub.startWithSolaceSession('GRAPHQL_QUEUE', mockSolaceSession);

    expect(createMessageConsumerSpy).toHaveBeenCalledTimes(1);
    expect(sessionConnectSpy).toHaveBeenCalledTimes(0);
    expect(messageConsumerConnectSpy).toHaveBeenCalledTimes(1);
  });

  test('It should create a message subscription', async () => {
    const mcAddSubscriptionSpy = jest.spyOn(mockMessageConsumer, 'addSubscription');
    let pubSub = await SolacePubSub.startWithSolaceSession('GRAPHQL_QUEUE', mockSolaceSession);
    await pubSub.subscribe('TEST/TOPIC', (message: solace.Message) => {});
    expect(mcAddSubscriptionSpy).toHaveBeenCalledTimes(1);
  });

  test('It should remove message subscription', async () => {
    const mcAddSubscriptionSpy = jest.spyOn(mockMessageConsumer, 'addSubscription');
    const mcRemoveSubscriptionSpy = jest.spyOn(mockMessageConsumer, 'removeSubscription');
    let pubSub = await SolacePubSub.startWithSolaceSession('GRAPHQL_QUEUE', mockSolaceSession);
    let id = await pubSub.subscribe('TEST/TOPIC', (message: solace.Message) => {});
    await pubSub.unsubscribe(id);
    expect(mcAddSubscriptionSpy).toHaveBeenCalledTimes(1);
    expect(mcRemoveSubscriptionSpy).toHaveBeenCalledTimes(1);
  });

  test('It should get a message on a regular topic subscription', async () => {
    const mcOnMessageSpy = jest.spyOn(mockMessageConsumer, 'on');
    let pubSub = await SolacePubSub.startWithSolaceSession('GRAPHQL_QUEUE', mockSolaceSession);

    let fn = {
      doNothing() {},
    };

    let triggerSpy = jest.spyOn(fn, 'doNothing');

    const binaryAttachment = new Blob(['{}'], { type: 'text/plain; charset=utf-8' }).arrayBuffer();
    let message = new MockSolaceMessage();
    message.setDestination(solace.SolclientFactory.createTopicDestination('TEST/TOPIC'));
    const iterator = pubSub.asyncIterator<any>('TEST/TOPIC');

    iterator.next().then(() => {
      fn.doNothing();
      expect(triggerSpy).toBeCalledTimes(1);
    });

    await pubSub.subscribe('TEST/TOPIC', (message: solace.Message) => {});
    mockMessageConsumer.emit(solace.MessageConsumerEventName.MESSAGE, message);
  });

  test('It should get a message on a wildcarded topic subscription', async () => {
    const mcOnMessageSpy = jest.spyOn(mockMessageConsumer, 'on');
    let pubSub = await SolacePubSub.startWithSolaceSession('GRAPHQL_QUEUE', mockSolaceSession);

    let fn = {
      doNothing() {},
    };

    let triggerSpy = jest.spyOn(fn, 'doNothing');

    const binaryAttachment = new Blob(['{}'], { type: 'text/plain; charset=utf-8' }).arrayBuffer();
    let message = new MockSolaceMessage();
    message.setDestination(solace.SolclientFactory.createTopicDestination('TEST/TOPIC'));
    const iterator = pubSub.asyncIterator<any>('TEST/*');

    iterator.next().then(() => {
      fn.doNothing();
      expect(triggerSpy).toBeCalledTimes(1);
    });

    await pubSub.subscribe('TEST/*', (message: solace.Message) => {});
    mockMessageConsumer.emit(solace.MessageConsumerEventName.MESSAGE, message);
  });

  test('It should only get a message once', async () => {
    const mcOnMessageSpy = jest.spyOn(mockMessageConsumer, 'on');
    let pubSub = await SolacePubSub.startWithSolaceSession('GRAPHQL_QUEUE', mockSolaceSession);

    let fn = {
      doNothing() {},
    };

    let triggerSpy = jest.spyOn(fn, 'doNothing');

    const binaryAttachment = new Blob(['{}'], { type: 'text/plain; charset=utf-8' }).arrayBuffer();
    let message = new MockSolaceMessage();
    message.setDestination(solace.SolclientFactory.createTopicDestination('TEST/TOPIC'));

    let message2 = new MockSolaceMessage();
    message2.setDestination(solace.SolclientFactory.createTopicDestination('X/Y'));

    const iterator = pubSub.asyncIterator<any>('TEST/*');

    iterator.next().then(() => {
      fn.doNothing();
      expect(triggerSpy).toBeCalledTimes(1);
    });

    await pubSub.subscribe('TEST/*', (message: solace.Message) => {});
    mockMessageConsumer.emit(solace.MessageConsumerEventName.MESSAGE, message);
    mockMessageConsumer.emit(solace.MessageConsumerEventName.MESSAGE, message2);
  });
});
