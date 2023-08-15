import { PubSubEngine } from 'graphql-subscriptions/dist/pubsub-engine';
import { PubSubAsyncIterator } from './pubsub-async-iterator.js';
import solace from 'solclientjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * The SolacePubSubOptions is a convenience class that specifies the configuration object for Solace
 */
export class SolacePubSubOptions {
  url: string;
  vpnName: string;
  userName: string;
  password: string;

  constructor(url: string = 'ws://127.0.0.1:8008', vpnName: string = 'default', user: string = 'default', password: string = 'default') {
    this.url = url;
    this.vpnName = vpnName;
    this.userName = user;
    this.password = password;
  }
}

export class SolacePubSub implements PubSubEngine {
  private solaceClient: SolaceClient;
  private solacePubSubOptions: SolacePubSubOptions;
  private session: solace.Session;

  private queueName: string;
  private subscriptionMap: { [subId: number]: [string, Function] };
  private subsRefsMap: { [trigger: string]: Array<number> };
  private currentSubscriptionId: number;

  private constructor(queueName: string, solacePubSubOptions?: SolacePubSubOptions, session?: solace.Session) {
    this.queueName = queueName;
    this.subscriptionMap = {};
    this.subsRefsMap = {};
    this.currentSubscriptionId = 0;
    this.session = session;
    if (session == undefined && solacePubSubOptions == undefined) this.solacePubSubOptions = new SolacePubSubOptions();
  }

  static startWithDefaultOptions(queueName: string) {
    return new SolacePubSub(queueName);
  }

  static startWithSolaceOptions(queueName: string, solacePubSubOptions: SolacePubSubOptions) {
    return new SolacePubSub(queueName, solacePubSubOptions);
  }

  static startWithSolaceSession(queueName: string, session: solace.Session) {
    return new SolacePubSub(queueName, null, session);
  }

  private start() {
    //Instantiate a new SolaceClient
    this.solaceClient = new SolaceClient(this.onMessage.bind(this), this.session, this.solacePubSubOptions);

    //If the session is null, then the user didn't provide one so try to instantiate one yourself
    if (this.session == null) {
      this.solaceClient
        .connect()
        .then((info: string) => {
          this.solaceClient.consumeFromQueue(this.queueName);
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      this.solaceClient.consumeFromQueue(this.queueName);
    }
  }

  private onMessage(message: solace.Message) {
    console.log(message.getDestination().getName());

    const subscribers = [].concat(
      ...Object.keys(this.subsRefsMap)
        .filter((key) => SolacePubSub.matches(key, message.getDestination().getName()))
        .map((key) => this.subsRefsMap[key])
    );

    // Don't work for nothing..
    if (!subscribers || !subscribers.length) {
      return;
    }

    const messageString = message.getBinaryAttachment();
    try {
      const blob = new Blob([message.getBinaryAttachment()], { type: 'text/plain; charset=utf-8' });
      blob.text().then((text) => {
        let json = JSON.parse(text);
        for (const subId of subscribers) {
          const listener = this.subscriptionMap[subId][1];
          listener(json);
        }
      });
    } catch (e) {
      console.error('Unable to parse message received from queue');
    }
  }

  /**
   * Convenience function to match a topic subscription against an actual topic
   * @param pattern Topic subscription
   * @param topic topic from the message
   * @returns whether the topic filter matches the subscription
   */
  private static matches(pattern: string, topic: string): boolean {
    let isMatch = false;

    //Replace all * in the topic filter with a .* to make it regex compatible
    let regexdSub = pattern.replace(/\*/g, '.*');

    //if the last character is a '>', replace it with a .* to make it regex compatible
    if (pattern.lastIndexOf('>') == pattern.length - 1) regexdSub = regexdSub.substring(0, regexdSub.length - 1).concat('.*');

    let matched = topic.match(regexdSub);

    //if the matched index starts at 0, then the topic is a match with the topic filter
    if (matched && matched.index == 0) {
      isMatch = true;
      //Edge case if the pattern is a match but the last character is a *
      if (regexdSub.lastIndexOf('*') == pattern.length - 1) {
        //Check if the number of topic sections are equal
        if (regexdSub.split('/').length != topic.split('/').length) isMatch = false;
      }
    }
    return isMatch;
  }

  publish(triggerName: string, payload: any): Promise<void> {
    return this.solaceClient.publishMessage(triggerName, JSON.stringify(payload));
  }

  subscribe(triggerName: string, onMessage: Function): Promise<number> {
    const id = this.currentSubscriptionId++;
    this.subscriptionMap[id] = [triggerName, onMessage];

    let refs = this.subsRefsMap[triggerName];
    if (refs && refs.length > 0) {
      const newRefs = [...refs, id];
      this.subsRefsMap[triggerName] = newRefs;
      return Promise.resolve(id);
    } else {
      return new Promise<number>((resolve, reject) => {
        // 1. Subscribing using the Solace Client
        this.solaceClient
          .addSubscriptionToQueue(triggerName)
          .then(() => {
            // 2. Saving the new sub id
            const subscriptionIds = this.subsRefsMap[triggerName] || [];
            this.subsRefsMap[triggerName] = [...subscriptionIds, id];

            // 3. Resolving the subscriptions id to the Subscription Manager
            resolve(id);
          })
          .catch((err) => reject(err));
      });
    }
  }
  unsubscribe(subId: number) {
    const [triggerName = null] = this.subscriptionMap[subId] || [];
    const refs = this.subsRefsMap[triggerName];

    if (!refs) {
      throw new Error(`There is no subscription of id "${subId}"`);
    }

    let newRefs;
    if (refs.length === 1) {
      this.solaceClient.removeSubscriptionFromQueue(triggerName).then(() => {
        newRefs = [];
      });
    } else {
      const index = refs.indexOf(subId);
      if (index > -1) {
        newRefs = [...refs.slice(0, index), ...refs.slice(index + 1)];
      }
    }

    this.subsRefsMap[triggerName] = newRefs;
    delete this.subscriptionMap[subId];
  }
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T, any, undefined> {
    return new PubSubAsyncIterator<T>(this, triggers);
  }
}

//Convenience wrapper class to simplify Solace operations
class SolaceClient {
  //Solace session object
  private session: solace.Session = null;

  private solaceConfig: SolacePubSubOptions;

  private messageConsumer: solace.MessageConsumer;
  private queueConsumerCallback: any;
  private isConsuming = false;

  constructor(callback: any, session?: solace.Session, solaceClientConfig?: SolacePubSubOptions) {
    //Initializing the solace client library
    let factoryProps = new solace.SolclientFactoryProperties();
    factoryProps.profile = solace.SolclientFactoryProfiles.version10;
    solace.SolclientFactory.init(factoryProps);
    this.session = session;
    this.solaceConfig = solaceClientConfig;

    this.queueConsumerCallback = callback;
  }
  /**
   * Asynchronous function that connects to the Solace Broker and returns a promise.
   * Only required if a session isn't passed directly to this class
   */
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.session != undefined) {
        console.warn('Already connected and ready to subscribe.');
      } else {
        // if there's no session, create one with the properties imported from the game-config file
        try {
          if (this.solaceConfig.url.indexOf('ws') != 0) {
            reject('HostUrl must be the WebMessaging Endpoint that begins with either ws:// or wss://. Please check your game-config.ts!');
            return;
          }

          this.session = solace.SolclientFactory.createSession({
            url: this.solaceConfig.url,
            vpnName: this.solaceConfig.vpnName,
            userName: this.solaceConfig.userName,
            password: this.solaceConfig.password,
            connectRetries: 3,
            publisherProperties: {
              enabled: true,
              acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE,
            },
          });
        } catch (error) {
          console.error(error.toString());
        }
        // define session event listeners

        //The UP_NOTICE dictates whether the session has been established
        this.session.on(solace.SessionEventCode.UP_NOTICE, (sessionEvent: solace.SessionEvent) => {
          console.info('=== Successfully connected and ready to subscribe. ===');
          resolve('Connected');
        });

        //The CONNECT_FAILED_ERROR implies a connection failure
        this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (sessionEvent: solace.SessionEvent) => {
          console.error('Connection failed to the message router: ' + sessionEvent.infoStr + ' - check correct parameter values and connectivity!');
          reject(`Check your connection settings and try again!`);
        });

        //DISCONNECTED implies the client was disconnected
        this.session.on(solace.SessionEventCode.DISCONNECTED, (sessionEvent: solace.SessionEvent) => {
          console.info('Disconnected.');
          if (this.session !== null) {
            this.session.dispose();
            this.session = null;
          }
        });

        // connect the session
        try {
          this.session.connect();
        } catch (error) {
          console.info(error.toString());
        }
      }
    });
  }

  disconnect() {
    console.info('Disconnecting from Solace message router...');
    if (this.session !== null) {
      try {
        this.session.disconnect();
      } catch (error) {
        console.error(error.toString());
      }
    } else {
      console.error('Not connected to Solace message router.');
    }
  }

  /**
   * Convenience function to consume from a queue
   *
   * @param queueName Name of the queue to consume from
   * @param callback The callback function for the message receipt
   */
  consumeFromQueue(queueName: string) {
    if (this.session == null) {
      console.error('Not connected to Solace!');
    } else {
      if (this.isConsuming) console.warn(`Already connected to the queue ${queueName}`);
      else {
        this.messageConsumer = this.session.createMessageConsumer({
          queueDescriptor: { name: queueName, type: solace.QueueType.QUEUE },
          acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT,
          createIfMissing: true,
        });

        this.messageConsumer.on(solace.MessageConsumerEventName.UP, () => {
          console.info('Succesfully connected to and consuming from ' + queueName);
        });

        this.messageConsumer.on(solace.MessageConsumerEventName.CONNECT_FAILED_ERROR, () => {
          console.error('Consumer cannot bind to queue ' + queueName);
        });

        this.messageConsumer.on(solace.MessageConsumerEventName.DOWN, () => {
          console.error('The message consumer is down');
        });

        this.messageConsumer.on(solace.MessageConsumerEventName.DOWN_ERROR, () => {
          console.error('An error happend, the message consumer is down');
        });

        this.messageConsumer.on(solace.MessageConsumerEventName.MESSAGE, (message: solace.Message) => {
          this.queueConsumerCallback(message);
          message.acknowledge();
        });

        try {
          this.messageConsumer.connect();
          this.isConsuming = true;
        } catch (err) {
          console.error('Cannot start the message consumer on queue ' + queueName + ' because: ' + err);
        }
      }
    }
  }

  /**
   * Function that adds a subscription to a queue
   * @param topicSubscription - topic subscription string to add to the queue
   */
  public addSubscriptionToQueue(topicSubscription: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let correlationKey = uuidv4();
      this.resolveRejectSubscriptionFunctions(correlationKey, resolve, reject);
      this.messageConsumer.addSubscription(solace.SolclientFactory.createTopicDestination(topicSubscription), correlationKey, 1000);
    });
  }

  /**
   * Function that removes a topic subscription from a queue
   * @param topicSubscription Topic to be removed from the queue
   */
  public removeSubscriptionFromQueue(topicSubscription: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let correlationKey = uuidv4();
      this.resolveRejectSubscriptionFunctions(correlationKey, resolve, reject);
      this.messageConsumer.removeSubscription(solace.SolclientFactory.createTopicDestination(topicSubscription), correlationKey, 1000);
    });
  }

  /**
   * Convenience function to resolve or reject subscription actions based on the co-relationkey
   * @param correlationKey the unique identifier for the subscription action
   * @param resolve the resolve function
   * @param reject the reject function
   */
  private resolveRejectSubscriptionFunctions(correlationKey: any, resolve: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void) {
    let onAck, onNak;

    //The function to be called if the Ack happends
    onAck = (evt: solace.MessageConsumerEvent) => {
      if (evt.correlationKey !== correlationKey) return;
      this.messageConsumer.removeListener(solace.MessageConsumerEventName.SUBSCRIPTION_OK, onAck);
      this.messageConsumer.removeListener(solace.MessageConsumerEventName.SUBSCRIPTION_ERROR, onNak);
      resolve();
    };

    //The function to be called if the action is rejected
    onNak = (evt: solace.MessageConsumerEvent) => {
      if (evt.correlationKey !== correlationKey) return;
      this.messageConsumer.removeListener(solace.MessageConsumerEventName.SUBSCRIPTION_OK, onAck);
      this.messageConsumer.removeListener(solace.MessageConsumerEventName.SUBSCRIPTION_ERROR, onNak);
      reject();
    };

    //Add the relevant events
    this.messageConsumer.addListener(solace.MessageConsumerEventName.SUBSCRIPTION_OK, onAck);
    this.messageConsumer.addListener(solace.MessageConsumerEventName.SUBSCRIPTION_ERROR, onNak);
  }

  /**
   *
   * @param queueName Name of the queue to consume from
   */
  stopConsumeFromQueue(queueName: string) {
    if (this.isConsuming) {
      this.messageConsumer.stop();
      this.isConsuming = false;
    }
  }

  /**
   * Publish a guaranteed message on a topic
   * @param topic Topic to publish on
   * @param payload Payload on the topic
   */
  async publishMessage(topic: string, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.session) {
        console.error('Cannot publish because not connected to Solace message router!');
        reject();
        return;
      }

      const binaryAttachment = new Blob([payload], { type: 'text/plain; charset=utf-8' }).arrayBuffer();
      let message = solace.SolclientFactory.createMessage();
      message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
      binaryAttachment.then((buffer) => {
        const correlationKey = uuidv4();

        message.setCorrelationKey(correlationKey);
        message.setBinaryAttachment(new Uint8Array(buffer));
        message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);

        let onAck, onNak;
        //call to be made on succesful publish
        onAck = (evt: solace.SessionEvent) => {
          if (evt.correlationKey !== correlationKey) {
            return;
          }
          this.session.removeListener(String(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE), onAck);
          this.session.removeListener(String(solace.SessionEventCode.REJECTED_MESSAGE_ERROR), onNak);
          resolve();
        };

        //call to be made on rejected publish
        onNak = (evt: solace.SessionEvent) => {
          console.log('Unsuccesfully published!');
          if (evt.correlationKey !== correlationKey) {
            return;
          }
          this.session.removeListener(String(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE), onAck);
          this.session.removeListener(String(solace.SessionEventCode.REJECTED_MESSAGE_ERROR), onNak);
          reject();
        };

        try {
          //register the callbacks on publish
          this.session.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, onAck);
          this.session.on(solace.SessionEventCode.REJECTED_MESSAGE_ERROR, onNak);
          this.session.send(message);
        } catch (error) {
          //remove the callbacks on error
          this.session.removeListener(String(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE), onAck);
          this.session.removeListener(String(solace.SessionEventCode.REJECTED_MESSAGE_ERROR), onNak);
          console.error(error);
          reject();
        }
      });
    });
  }
}
