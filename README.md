# FGBackend

This is the backend repo for &#34;Focus Groups&#34; from doodleflow

## New DB Schema Changes

Since we moved *ProjectTeamMembers* into separate collection. The payload for the *assignToProjects* and *removeUser* endpoints are changed.

#### api/v1/teams/assignToProjects
~~~
{
    "addUsers": [
        {
            "userId" : "<userId>",
            "email" : "<email>",
            "firstName" : "<firstName>"
        }
    ],
    "removeUsers": [
        {
            "userId" : "<userId>",
            "email" : "<email>",
            "firstName" : "<firstName>"
        }
    ]
    "projectId": "<projectId>"
}
~~~

#### api/v1/teams/removeMember

~~~
{
	"user": {
        "userId" : "<userId>",
        "email" : "<email>",
        "firstName" : "<firstName>"
    },
    "projectId": "<projectId>"
}
~~~

---

## Interactions
There are four endpoints for interactions module.

#### POST api/v1/interactions
```
{
	"screenId" : "5e66324f2faf411dbbd1a21a",
	"event" : "click",
	"bounds" : {
		"x" : 10,
		"y" : 20,
		"width" : 100,
		"height" : 100
	},
	"targetType" : "screen",
	"targetScreenId" : "5e662e732faf411dbbd1a218",
	"targetUrl" : null,
	"focusGroupId" : "5e662d6b91d1fd1dba0c4fd6"
}
```
Note: There is no way to update the existing interactions. You will have to delete it and create new if that case.

#### DELETE api/v1/interactions/remove/:id

Here id refers to interaction's _id.

#### DELETE api/v1/interactions/remove/all/:screenId

Removes all the interactions for the given screenId.

#### GET api/v1/interactions/:screenId

Gets all the interactions for the given screenId.

---

## Team Payment History
We have created two endpoints for payment histories.

#### GET api/v1/teams/payments/:teamId

It will return payment histories of the given teamId.

#### GET api/v1/teams/payments/invoice/:id

User can download an invoice for given team payments id.