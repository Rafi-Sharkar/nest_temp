# Notification Documentation

## Overview

This project uses NestJS EventEmitter and Socket.IO for real-time notifications.

Notification flow:

1. A service emits an event with EventEmitter2.
2. NotificationListener receives the event using @OnEvent.
3. Listener checks recipient notification toggle settings.
4. Listener emits real-time socket notification through NotificationGateway.

## Event Constants

Event constants are defined in [interface/event.name.ts](interface/event.name.ts).

Main constants:

* EVENT\_TYPES.USERREGISTRATION\_CREATE = user.create

* EVENT\_TYPES.GUARDIANREGISTRATION\_CREATE = guardian.create

* EVENT\_TYPES.CHILDREN\_CREATE = children.create

* EVENT\_TYPES.PAYMENT\_CREATE = payment.create

* EVENT\_TYPES.CONTACT\_CREATE = contact.create

* EVENT\_TYPES.CONTACT\_SUBSCRIBE\_CREATE = contact.subscribe.create

## Which Event and Listener to Use

| Use case                                         | Event constant                            | Event name      | Listener method                   | Listener file                                                                                  | Notification toggle  | Current emitter file                                                                     | Current emitter method |
| ------------------------------------------------ | ----------------------------------------- | --------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- | ---------------------- |
| Guardian verifies account -> notify center admin | EVENT\_TYPES.GUARDIANREGISTRATION\_CREATE | guardian.create | handleGuardianRegistrationCreated | [NotificationListiner/notification.listiner.ts](NotificationListiner/notification.listiner.ts) | guardianRegistration | [../../auth/services/auth-otp.service.ts](../../auth/services/auth-otp.service.ts)       | verifyOTP              |
| Guardian creates child -> notify center admin    | EVENT\_TYPES.CHILDREN\_CREATE             | children.create | handleChildrenCreated             | [NotificationListiner/notification.listiner.ts](NotificationListiner/notification.listiner.ts) | children             | [../../guardian/service/guardian.service.ts](../../guardian/service/guardian.service.ts) | createChild            |
| Public contact form submit -> notify super admins | EVENT\_TYPES.CONTACT\_CREATE              | contact.create  | handleContactCreated              | [NotificationListiner/notification.listiner.ts](NotificationListiner/notification.listiner.ts) | message              | [../../shared/contact/contact.service.ts](../../shared/contact/contact.service.ts)       | create                 |
| Custom offer subscription -> notify super admins | EVENT\_TYPES.CONTACT\_SUBSCRIBE\_CREATE  | contact.subscribe.create | handleContactSubscribeCreated | [NotificationListiner/notification.listiner.ts](NotificationListiner/notification.listiner.ts) | message              | [../../shared/contact/contact.service.ts](../../shared/contact/contact.service.ts)       | subscribeToCustomOffers |

## Payload Shape

Payload meta contracts are defined in [interface/event.name.ts](interface/event.name.ts).

### Guardian verification payload

Use this for EVENT\_TYPES.GUARDIANREGISTRATION\_CREATE:

```ts
{
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: string,
      email: string,
      name: string,
      phone?: string,
      createdAt: Date,
      recipients: [{ id: string, email: string }]
    },
    meta: {
      guardianId?: string,
      centerId?: string
    }
  }
}
```

### Child creation payload

Use this for EVENT\_TYPES.CHILDREN\_CREATE:

```ts
{
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: string,
      createdBy: string,
      createdAt: Date,
      recipients: [{ id: string, email: string }]
    },
    meta: {
      childFirstName?: string,
      childLastName?: string,
      guardianId?: string,
      centerId?: string
    }
  }
}
```

### Contact message payload

Use this for EVENT\_TYPES.CONTACT\_CREATE:

```ts
{
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: string,
      name: string,
      email: string,
      createdAt: Date,
      recipients: [{ id: string, email: string }]
    },
    meta: {
      subject?: string
    }
  }
}
```

### Contact subscribe payload

Use this for EVENT\_TYPES.CONTACT\_SUBSCRIBE\_CREATE:

```ts
{
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: string,
      name?: string,
      email?: string,
      createdAt: Date,
      recipients: [{ id: string, email: string }]
    },
    meta: {
      customPrice?: string,
      feature?: string[]
    }
  }
}
```

## Emitter Examples

### Emit guardian verified

```ts
this.eventEmitter.emit(EVENT_TYPES.GUARDIANREGISTRATION_CREATE, {
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: guardianUserId,
      email: guardianEmail,
      name: guardianName,
      createdAt: new Date(),
      recipients: [{ id: centerAdminId, email: centerAdminEmail }],
    },
    meta: {
      guardianId,
      centerId,
    },
  },
});
```

### Emit child created

```ts
this.eventEmitter.emit(EVENT_TYPES.CHILDREN_CREATE, {
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: childId,
      createdBy: guardianName,
      createdAt: new Date(),
      recipients: [{ id: centerAdminId, email: centerAdminEmail }],
    },
    meta: {
      childFirstName,
      childLastName,
      guardianId,
      centerId,
    },
  },
});
```

### Emit contact created

```ts
this.eventEmitter.emit(EVENT_TYPES.CONTACT_CREATE, {
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      createdAt: contact.createdAt,
      recipients: superAdminRecipients,
    },
    meta: {
      subject: contact.subject,
    },
  },
});
```

### Emit contact subscription created

```ts
this.eventEmitter.emit(EVENT_TYPES.CONTACT_SUBSCRIBE_CREATE, {
  action: 'CREATE',
  meta: {
    action: 'created',
    info: {
      id: subscription.id,
      name: subscription.name,
      email: subscription.email,
      createdAt: subscription.createdAt,
      recipients: superAdminRecipients,
    },
    meta: {
      customPrice: subscription.customPrice,
      feature: subscription.feature,
    },
  },
});
```

## Listener Registration

Notification listener class:

* [NotificationListiner/notification.listiner.ts](NotificationListiner/notification.listiner.ts)

Module registration:

* [../notifications.module.ts](../notifications.module.ts)

It is registered as provider:

* NotificationListener

* NotificationGateway

## Socket Namespace

Socket gateway namespace:

* /notifications

Gateway file:

* [NotificationGateway/notification.gateway.ts](NotificationGateway/notification.gateway.ts)

## Frontend Integration

Use this table as the frontend task checklist for loading and managing notifications.

| Frontend task                               | Endpoint or socket                                                  | What to do                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Load initial notification list on page open | GET /notification/all-notifications                                 | Call once after login with Bearer token. Store total, unread, and notifications in state. |
| Load unread badge count                     | GET /notification/unread-notifications                              | Call on app start and after read or delete actions. Use unread for bell badge count.      |
| Connect realtime channel                    | Socket namespace /notifications                                     | Connect with auth token in Authorization header or in auth.token.                         |
| Listen realtime events                      | guardian.create, children.create, payment.create, user.create, contact.create, contact.subscribe.create | On each event, prepend a new item to list and increment unread badge.                     |
| Mark one notification read                  | GET /notification/read-single-notification?notificationId=...       | Update local item read=true and decrement unread badge.                                   |
| Mark all read                               | PATCH /notification/make-all-notification-read                      | Set all local items read=true and unread=0.                                               |
| Delete one notification                     | DELETE /notification/delete-single-notifications?notificationId=... | Remove the item from list and refresh counts.                                             |
| Delete all notifications                    | DELETE /notification/delete-notification                            | Clear local list and set counts to zero.                                                  |
| Handle reconnect                            | Socket reconnect event                                              | Re-fetch GET /notification/all-notifications after reconnect to avoid missed messages.    |

### Frontend Loading Flow

1. After successful login, call GET /notification/all-notifications.
2. Open socket connection to /notifications using the same JWT.
3. Subscribe to events: guardian.create, children.create, payment.create, user.create, contact.create, contact.subscribe.create.
4. Merge realtime notifications into local list state.
5. Keep unread badge synced by applying optimistic updates plus periodic unread refresh.

### Backend References for Frontend Team

* REST routes: [socket-notification.controller.ts](socket-notification.controller.ts)

* Socket auth and namespace: [NotificationGateway/notification.gateway.ts](NotificationGateway/notification.gateway.ts)

* Event handlers: [NotificationListiner/notification.listiner.ts](NotificationListiner/notification.listiner.ts)

### Important Note

In [socket-notification.service.ts](socket-notification.service.ts), the unread query currently does not include the notification relation but tries to access notification fields while mapping. If unread API returns incomplete data, update unread query to include notification: true.

## Notes

* If recipient user has no active socket connection, event is processed but not delivered in real time.

* Delivery depends on notification toggle flags in NotificationToggle table.

* Contact-related events use the `message` notification toggle and target users with role SUPER_ADMIN.

* For center admin notifications, always pass center admin in recipients.
