
// User defined class node 
class Node {
    // constructor 
    constructor(element) {
        this.parent = element; //Element holds the data of a node 
        this.child = null // next holds the pointer to the next node
    }
}

// linkedlist class 
class LinkedList {
    constructor() {
        this.head = null; //head stores the first node of a List.
        this.size = 0; //size indicates the number of nodes in a list.
    }
}
let linkedListController = {
    /**
     * If the list is empty then add an element and it will be head. 
     * If the list is not empty then iterate to the end of the list and add an element at the end of the list
     */
    add(element) {
        // creates a new node 
        var node = new Node(element);

        console.log("this.head", this.head);
        console.log("current", current);

        console.log("*********************");

        // to store current node 
        var current;

        // if list is Empty add the 
        // element and make it head 
        if (this.head == null)
            this.head = node;
        else {
            current = this.head;

            // iterate to the end of the 
            // list 
            while (current.child) {
                current = current.child;
            }

            // add node 
            current.child = node;
        }
        this.size++;
        return current;
    },
    // insert element at the position index 
    // of the list 
    insertAt(element, index) {
        if (index > 0 && index > this.size)
            return false;
        else {
            // creates a new node 
            var node = new Node(element);
            var curr, prev;

            curr = this.head;

            // add the element to the 
            // first index 
            if (index == 0) {
                node.next = head;
                this.head = node;
            } else {
                curr = this.head;
                var it = 0;

                // iterate over the list to find 
                // the position to insert 
                while (it < index) {
                    it++;
                    prev = curr;
                    curr = curr.next;
                }

                // adding an element 
                node.next = curr;
                prev.next = node;
            }
            this.size++;
        }
        return current;
    },

    // removes an element from the 
    // specified location 
    removeFrom(index) {
        if (index > 0 && index > this.size)
            return -1;
        else {
            var curr, prev, it = 0;
            curr = this.head;
            prev = curr;

            // deleting first element 
            if (index === 0) {
                this.head = curr.next;
            } else {
                // iterate over the list to the 
                // position to removce an element 
                while (it < index) {
                    it++;
                    prev = curr;
                    curr = curr.next;
                }
                // remove the element 
                prev.next = curr.next;
            }
            this.size--;

            // return the remove element 
            return curr.element;
        }
    }
}


module.exports = linkedListController;