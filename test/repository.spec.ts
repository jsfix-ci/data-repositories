import { lastValueFrom } from 'rxjs';
import Dexie from 'dexie';
import indexedDB from 'fake-indexeddb';
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import 'jest';
import 'reflect-metadata';
import {DatabaseAccess} from "../src";
import {IncrementalTestClass, IncrementalTestRepository} from "./incremental-test-repository";
import {MappingTestRepository, ObservableMappingTestRepository, TestObject} from "./mapping-test-repository";
import {NoDecoratedFieldsRepository} from "./no-decorated-fields-repository";
import {NoMappingRepository, NoMappingTestObject} from "./no-mapping-repository";
import {
    VersioningObjectFour,
    VersioningObjectOne,
    VersioningObjectThree,
    VersioningObjectTwo,
    VersionTestRepositoryFour,
    VersionTestRepositoryOne,
    VersionTestRepositoryThree,
    VersionTestRepositoryTwo
} from "./version-test-repository";
import {CompoundIdRepository, CompoundTestObject} from "./compound-id-repository";

export class TestDatabaseAccess extends DatabaseAccess {
    constructor(name: string) {
        super(new Dexie(name, {indexedDB: indexedDB, IDBKeyRange: IDBKeyRange}));
    }
}

export let testDatabaseAccess: DatabaseAccess;

describe('A repository', () => {

    beforeEach(() => {
        openDatabase();
    });

    afterEach(async () => {
        await deleteDatabase();
    });

    function openDatabase() {
        testDatabaseAccess = new TestDatabaseAccess("test");
    }

    function closeDatabase() {
        testDatabaseAccess.db.close();
    }

    async function deleteDatabase() {
        await testDatabaseAccess.db.delete();
    }

    test('should not be created when the stored object does not have a field decorated with @Id or @IncrementalId', () => {
        expect(() => new NoDecoratedFieldsRepository()).toThrowError(/.*@Id.*@IncrementalId.*/g);
    });

    test('should be created and save and retrieve a value', async () => {
        const repo = new NoMappingRepository();
        expect(repo.repositoryName).toEqual("NoMappingRepository");

        let obj = new NoMappingTestObject("gandalf", 42);

        let key = await lastValueFrom(repo.save(obj));
        expect(key).toBe("gandalf");

        let retrieved = await lastValueFrom(repo.findById("gandalf"));
        expect(retrieved).toBeInstanceOf(NoMappingTestObject);
        expect(retrieved).toEqual(obj);
        expect(retrieved.name).toEqual("gandalf");
        expect(retrieved.salary).toEqual(42);
    });

    test('should save and find multiple values', async () => {
        const repo = new NoMappingRepository();

        let gandalf = new NoMappingTestObject("gandalf", 42);
        let gimli = new NoMappingTestObject("gimli", 12);
        let aragorn = new NoMappingTestObject("aragorn", 500);
        let legolas = new NoMappingTestObject("legolas", 2);

        await lastValueFrom(repo.saveAll(gandalf, gimli, aragorn, legolas));

        let retrieved = await lastValueFrom(repo.findAll());
        expect(retrieved).toContainEqual(gandalf);
        expect(retrieved).toContainEqual(gimli);
        expect(retrieved).toContainEqual(aragorn);
        expect(retrieved).toContainEqual(legolas);

    });

    test('should be able to clear the data', async () => {
        const repo = new NoMappingRepository();

        let gandalf = new NoMappingTestObject("gandalf", 42);
        await lastValueFrom(repo.save(gandalf));
        expect(await lastValueFrom(repo.count())).toBe(1);
        await lastValueFrom(repo.clear());
        expect(await lastValueFrom(repo.count())).toBe(0);
    });

    test('should be able to delete values', async () => {
        const repo = new NoMappingRepository();

        let gandalf = new NoMappingTestObject("gandalf", 42);
        let gimli = new NoMappingTestObject("gimli", 12);

        await lastValueFrom(repo.saveAll(gandalf, gimli));
        expect(await lastValueFrom(repo.count())).toBe(2);

        await lastValueFrom(repo.delete("gandalf"));
        let retrieved = await lastValueFrom(repo.findAll());
        expect(retrieved).toHaveLength(1);
        expect(retrieved).toContainEqual(gimli);
    });

    test('should be able to map values to a model and back', async () => {
        const repo = new MappingTestRepository();

        let gandalf = new TestObject("gandalf@the-whi.te", "gandalf");
        await lastValueFrom(repo.save(gandalf));
        expect(await lastValueFrom(repo.count())).toBe(1);
        expect(await lastValueFrom(repo.findById("gandalf@the-whi.te"))).toEqual(gandalf);
    });

    test('should be able to map values to a model and back using observables', async () => {
        const repo = new ObservableMappingTestRepository();

        let gandalf = new TestObject("gandalf@the-whi.te", "gandalf");
        await lastValueFrom(repo.save(gandalf));
        expect(await lastValueFrom(repo.count())).toBe(1);
        expect(await lastValueFrom(repo.findById("gandalf@the-whi.te"))).toEqual(gandalf);
    });

    test('should be able to store values using incremental ids', async () => {
        const repo = new IncrementalTestRepository();
        expect(repo.idPropertyName).toBe("id");

        let fotr = new IncrementalTestClass("The Fellowship Of The Ring", "JRRT");
        let ttt = new IncrementalTestClass("The Two Towers", "JRRT");
        let rork = new IncrementalTestClass("The Return Of The King", "JRRT");

        let agot = new IncrementalTestClass("A Game Of Thrones", "GRRM");
        let acok = new IncrementalTestClass("A Clash Of Kings", "GRRM");
        let asos = new IncrementalTestClass("A Storm Of Swords", "GRRM");
        let affc = new IncrementalTestClass("A Feast For Crows", "GRRM");
        let adwd = new IncrementalTestClass("A Dance With Dragons", "GRRM");

        await lastValueFrom(repo.saveAll(fotr, ttt, rork, agot, acok, asos, affc, adwd));

        let firstItem = await lastValueFrom(repo.findById(1));
        expect(firstItem.author).toEqual(fotr.author);
        expect(firstItem.title).toEqual(fotr.title);

        let middleItem = await lastValueFrom(repo.findById(4));
        expect(middleItem.author).toEqual(agot.author);
        expect(middleItem.title).toEqual(agot.title);

        let lastItem = await lastValueFrom(repo.findById(8));
        expect(lastItem.author).toEqual(adwd.author);
        expect(lastItem.title).toEqual(adwd.title);
    });

    test('should be able to find stored objects using incremental, indexed or unique properties', async () => {
        const repo = new IncrementalTestRepository();
        expect(repo.idPropertyName).toBe("id");

        let fotr = new IncrementalTestClass("The Fellowship Of The Ring", "JRRT");
        let ttt = new IncrementalTestClass("The Two Towers", "JRRT");
        let rork = new IncrementalTestClass("The Return Of The King", "JRRT");

        let agot = new IncrementalTestClass("A Game Of Thrones", "GRRM");
        let acok = new IncrementalTestClass("A Clash Of Kings", "GRRM");
        let asos = new IncrementalTestClass("A Storm Of Swords", "GRRM");
        let affc = new IncrementalTestClass("A Feast For Crows", "GRRM");
        let adwd = new IncrementalTestClass("A Dance With Dragons", "GRRM");

        await lastValueFrom(repo.saveAll(fotr, ttt, rork, agot, acok, asos, affc, adwd));

        let grrms = await lastValueFrom(repo.search().andEqual("author", "GRRM").find());
        expect(grrms).toHaveLength(5);

        let jrrts = await lastValueFrom(repo.search().andEqual("author", "JRRT").find());
        expect(jrrts).toHaveLength(3);

        let feastForCrows = await lastValueFrom(repo.search().andEqual("author", "GRRM")
            .andEqual("title", "A Feast For Crows")
            .andNotEqual("author", "JRRT")
            .find());
        expect(feastForCrows).toHaveLength(1);
        expect(feastForCrows[0].title).toBe(affc.title);
    });

    test('should be able to use predicate filters on search queries', async () => {
        const repo = new IncrementalTestRepository();

        let fotr = new IncrementalTestClass("The Fellowship Of The Ring", "JRRT");
        let ttt = new IncrementalTestClass("The Two Towers", "JRRT");
        let rork = new IncrementalTestClass("The Return Of The King", "JRRT");

        let agot = new IncrementalTestClass("A Game Of Thrones", "GRRM");
        let acok = new IncrementalTestClass("A Clash Of Kings", "GRRM");
        let asos = new IncrementalTestClass("A Storm Of Swords", "GRRM");
        let affc = new IncrementalTestClass("A Feast For Crows", "GRRM");
        let adwd = new IncrementalTestClass("A Dance With Dragons", "GRRM");

        await lastValueFrom(repo.saveAll(fotr, ttt, rork, agot, acok, asos, affc, adwd));

        expect(await lastValueFrom(repo.count())).toBe(8);

        let itemsWithOfInTheTitle = await lastValueFrom(repo.search().and(model => model.title.includes("Of")).find());

        expect(itemsWithOfInTheTitle).toBeDefined();
        expect(itemsWithOfInTheTitle).toHaveLength(5);
    });

    test('should be able to use compound primary keys', async () => {
        let repo = new CompoundIdRepository();
        expect(repo.idPropertyName).toBe("[firstName+lastName]");

        let testObj1 = new CompoundTestObject("Gandalf", "the White");
        let testObj2 = new CompoundTestObject("Gimli", "the Dwarf");
        let testObj3 = new CompoundTestObject("Gandalf", "the White", "again");

        await lastValueFrom(repo.saveAll(testObj1, testObj2));
        expect(await lastValueFrom(repo.count())).toBe(2);

        await lastValueFrom(repo.save(testObj3));
        expect(await lastValueFrom(repo.count())).toBe(2);

        let gandalf = await lastValueFrom(repo.findById(["Gandalf", "the White"]));
        expect(gandalf).toBeInstanceOf(CompoundTestObject);
        expect(gandalf.nameSuffix).toBe("again");

        let found = await lastValueFrom(repo.search().andEqual("firstName", "Gandalf")
            .andEqual("lastName", "the White")
            .find());
        expect(found).toHaveLength(1);
    });

    test('should not break when multiple databases use different versions', async () => {
        let repo1 = new VersionTestRepositoryTwo();
        const testObject1 = new VersioningObjectTwo("gimli", "moria", "gimli@dwarfs.com");
        await lastValueFrom(repo1.save(testObject1));


        let repo2 = new VersionTestRepositoryThree();
        const testObject2 = new VersioningObjectThree("frodo", "04012345678");
        await lastValueFrom(repo2.save(testObject2));


        let repo3 = new VersionTestRepositoryFour();
        const testObject3 = new VersioningObjectFour("gandalf", "frodo");

        await lastValueFrom(repo3.save(testObject3));

        let found1 = await lastValueFrom(repo1.findAll());
        expect(found1).toHaveLength(1);
        expect(found1[0]).toEqual(testObject1);
    });

    test('should be able to use database versions', async () => {
        let repo = new VersionTestRepositoryOne();
        const testObject1 = new VersioningObjectOne("gandalf", "gandalf@yahoo.com");

        await lastValueFrom(repo.save(testObject1));
        closeDatabase();
        openDatabase();

        let repo2 = new VersionTestRepositoryTwo();
        expect(await lastValueFrom(repo2.count())).toBe(1);

        let gandalf = await lastValueFrom(repo2.findById("gandalf"));
        expect(gandalf).toEqual(testObject1);
        expect(gandalf).toBeInstanceOf(VersioningObjectTwo);
        expect(gandalf.address).toBeUndefined();

        const testObject2 = new VersioningObjectTwo("gimli", "moria", "gimli@dwarfs.com");
        await lastValueFrom(repo2.save(testObject2));
        const foundGimliByAddedProperty = await lastValueFrom(repo2.search().andEqual("address", "moria").find());
        expect(foundGimliByAddedProperty).toHaveLength(1);
        expect(foundGimliByAddedProperty[0]).toEqual(testObject2);
    });
});