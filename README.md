# graphql-solace-subscriptions


This package implements the AsyncIterator Interface and PubSubEngine Interface from the [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) package. 
It allows you to connect your subscriptions manager to the Solace PubSub+ broker to support a
horizontally scalable subscriptions setup.

## Installation

```
npm install graphql-solace-subscriptions
```

## Using the AsyncIterator Interface

Define your GraphQL schema with a `Subscription` type.

```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

type Subscription {
    somethingChanged: Result
}

type Result {
    id: String
}
```

Now, create a `SolacePubSub` instance.

```javascript
import { SolacePubSub } from 'graphql-solace-subscriptions';
const pubsub = await SolacePubSub.startWithDefaultOptions("GRAPH_QL_QUEUE"); // connecting to ws://localhost:8080 by default
```

Now, implement the Subscriptions type resolver, using `pubsub.asyncIterator` to map the event you need.

```javascript
const SOMETHING_CHANGED_TOPIC = 'SOMETHING/CHANGED';

export const resolvers = {
  Subscription: {
    somethingChanged: {
      subscribe: () => pubsub.asyncIterator(SOMETHING_CHANGED_TOPIC)
    }
  }
}
```

> Subscriptions resolvers are not a function, but an object with `subscribe` method, that returns `AsyncIterable`.

The `AsyncIterator` method will tell the MQTT client to listen for messages from the MQTT broker on the topic provided, and wraps that listener in an `AsyncIterator` object. 

When messages are received from the topic, those messages can be returned back to connected clients.

`pubsub.publish` can be used to send messages to a given topic.

```js
pubsub.publish(SOMETHING_CHANGED_TOPIC, { somethingChanged: { id: "123" }});
```

## Dynamically Create a Topic Based on Subscription Args Passed on the Query:

```javascript
export const resolvers = {
  Subscription: {
    somethingChanged: {
      subscribe: (_, args) => pubsub.asyncIterator(`${SOMETHING_CHANGED_TOPIC}.${args.relevantId}`),
    },
  },
}
```

## Using Arguments and Payload to Filter Events

```javascript
import { withFilter } from 'graphql-subscriptions';

export const resolvers = {
  Subscription: {
    somethingChanged: {
      subscribe: withFilter(
        (_, args) => pubsub.asyncIterator(`${SOMETHING_CHANGED_TOPIC}.${args.relevantId}`),
        (payload, variables) => payload.somethingChanged.id === variables.relevantId,
      ),
    },
  },
}
```

## Passing your own properties object

The basic usage is great for development and you will be able to connect to a locally hosted Solace PubSub+ event broker. But if you wanted to connect to a specific host, you can inject your own Solace properties.


 
```javascript
import { SolacePubSub, SolacePubSubOptions } from 'graphql-solace-subscriptions';

let solacePubSubOptions = new SolacePubSubOptions("wss://host:8081","vpn1","user","password");


const pubsub = await SolacePubSub.startWithSolaceOptions("GRAPH_QL_QUEUE",solacePubSubOptions);
```

## Passing your own Solace Session

If you want to take advantage of a different authentication mechanism, you have the ability to inject a fully instantiated Solace session into the SolacePubSub object.


 
```javascript
import { SolacePubSub } from 'graphql-solace-subscriptions';
import solace from 'solclientjs';

let session: solace.Session;

//instantiate your solace session


const pubsub = await SolacePubSub.startWithSolaceSession("GRAPH_QL_QUEUE",session);
```